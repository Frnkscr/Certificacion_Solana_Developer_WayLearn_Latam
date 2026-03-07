// client.ts (estilo Solana Playground, amigable por strings)
//
// Requisitos:
// - pg, web3, BN disponibles globalmente (como en Playground)

//////////////////// Context ////////////////////
const owner = pg.wallet.publicKey;
console.log("My address:", owner.toBase58());
const bal = await pg.connection.getBalance(owner);
console.log("My balance:", bal / web3.LAMPORTS_PER_SOL, "SOL");

//////////////////// Helpers ////////////////////
function u16le(n: number) {
  return new BN(n).toArrayLike(Buffer, "le", 2);
}
function u64le(n: number) {
  return new BN(n).toArrayLike(Buffer, "le", 8);
}
function toNum(x: any): number {
  return typeof x === "number" ? x : x.toNumber();
}

// Enum BloqueHorario (Rust: Matutino/Vespertina/Nocturno)
// TS: { matutino: {} } etc.
const Bloque = {
  matutino: { arg: { matutino: {} }, u8: 0 },
  vespertina: { arg: { vespertina: {} }, u8: 1 },
  nocturno: { arg: { nocturno: {} }, u8: 2 },
} as const;

//////////////////// PDA helpers ////////////////////
function pdaPromotora(ownerPk = owner) {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("promotora"), ownerPk.toBuffer()],
    pg.program.programId
  )[0];
}

function pdaRecinto(
  promotoraPda: web3.PublicKey,
  recintoId: string,
  recintoNum: number
) {
  return web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("recinto"),
      promotoraPda.toBuffer(),
      Buffer.from(recintoId),
      u64le(recintoNum),
    ],
    pg.program.programId
  )[0];
}

function pdaEvento(
  recintoPk: web3.PublicKey,
  yyyy: number,
  mm: number,
  dd: number,
  bloqueU8: number
) {
  return web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("evento"),
      recintoPk.toBuffer(),
      u16le(yyyy),
      Buffer.from([mm]),
      Buffer.from([dd]),
      Buffer.from([bloqueU8]),
    ],
    pg.program.programId
  )[0];
}

//////////////////// Read helpers (amigables) ////////////////////

/**
 * Devuelve la promotora registrada para la wallet (o null).
 */
async function getPromotora() {
  const promotoraPda = pdaPromotora(owner);
  try {
    const promotora = await pg.program.account.promotora.fetch(promotoraPda);
    return { promotoraPda, promotora };
  } catch {
    return { promotoraPda, promotora: null };
  }
}

/**
 * Imprime y devuelve el nombre de la promotora registrada.
 */
async function showPromotoraName() {
  const { promotoraPda, promotora } = await getPromotora();
  if (!promotora) {
    console.log("No hay promotora registrada para esta wallet.");
    return null;
  }
  console.log(
    `Promotora: "${promotora.nombrePromotora}" PDA=${promotoraPda.toBase58()}`
  );
  return promotora.nombrePromotora as string;
}

/**
 * Lista todos los recintos de la wallet.
 * (filtra por owner usando memcmp, sin dependencias externas)
 */
async function listRecintos() {
  const recintos = await pg.program.account.recinto.all([
    { memcmp: { offset: 8, bytes: owner.toBase58() } }, // owner en Recinto offset 8
  ]);

  console.log(`\nRecintos encontrados: ${recintos.length}`);
  recintos.forEach((r, idx) => {
    console.log(
      `#${idx + 1} id=${r.account.recintoId} | nombre=${
        r.account.recintoNombre
      } | num=${toNum(r.account.recintoNum)} | cap=${
        r.account.capacidadMaxima
      } | PDA=${r.publicKey.toBase58()}`
    );
  });

  return recintos;
}

/**
 * Busca un recinto por recinto_id (string) y devuelve su pubkey.
 * Si hay varios con mismo recinto_id, elige el más reciente por recinto_num.
 */
async function getKeyRecinto(recintoId: string) {
  const recintos = await listRecintos();
  const matches = recintos.filter((r) => r.account.recintoId === recintoId);

  if (matches.length === 0) {
    throw new Error(
      `No existe un recinto con recinto_id="${recintoId}" para esta wallet.`
    );
  }

  matches.sort(
    (a, b) => toNum(b.account.recintoNum) - toNum(a.account.recintoNum)
  );
  const selected = matches[0];

  console.log(
    `\ngetKeyRecinto("${recintoId}") => ${selected.publicKey.toBase58()} (num=${toNum(
      selected.account.recintoNum
    )})`
  );

  return selected.publicKey;
}

/**
 * Lista eventos de un recinto (recintoPubkey).
 * Usa memcmp sobre campo recinto_pda de Evento:
 * offset 40 = 8 discriminator + 32 owner
 */
async function listEventosByRecinto(recintoPk: web3.PublicKey) {
  const eventos = await pg.program.account.evento.all([
    { memcmp: { offset: 40, bytes: recintoPk.toBase58() } },
  ]);

  console.log(
    `\nEventos para recinto=${recintoPk.toBase58()}: ${eventos.length}`
  );
  eventos.forEach((e, idx) => {
    console.log(
      `#${idx + 1} nombre=${e.account.nombreEvento} | fecha=${
        e.account.fechaEventoYyyy
      }-${e.account.fechaEventoMm}-${e.account.fechaEventoDd} | bloque=${
        e.account.bloqueHorario
      } | cancelado=${e.account.cancelado} | PDA=${e.publicKey.toBase58()}`
    );
  });

  return eventos;
}

/**
 * Busca un evento por (recinto_id, fecha, bloque) usando las mismas seeds
 * y devuelve la pubkey del evento.
 */
async function getKeyEvento(params: {
  recintoId: string;
  yyyy: number;
  mm: number;
  dd: number;
  bloque: keyof typeof Bloque; // "matutino" | "vespertina" | "nocturno"
}) {
  const recintoPk = await getKeyRecinto(params.recintoId);
  const bloqueInfo = Bloque[params.bloque];
  const eventoPk = pdaEvento(
    recintoPk,
    params.yyyy,
    params.mm,
    params.dd,
    bloqueInfo.u8
  );

  console.log(
    `\ngetKeyEvento(recinto_id="${params.recintoId}", fecha=${params.yyyy}-${
      params.mm
    }-${params.dd}, bloque=${params.bloque}) => ${eventoPk.toBase58()}`
  );
  return eventoPk;
}

//////////////////// Write helpers (amigables) ////////////////////

/**
 * Crea promotora (solo si no existe). Amigable: recibe nombre string.
 */
async function ensurePromotora(nombre: string) {
  const { promotoraPda, promotora } = await getPromotora();
  if (promotora) {
    console.log("Promotora ya existe, no se crea de nuevo.");
    return promotoraPda;
  }

  const tx = await pg.program.methods
    .creaPromotora(nombre)
    .accounts({
      owner,
      promotora: promotoraPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log("Tx creaPromotora:", tx);
  return promotoraPda;
}

/**
 * Crea recinto.
 */
async function crearRecinto(recintoId: string, nombre: string, capMax: number) {
  const promotoraPda = pdaPromotora(owner);
  const promotora = await pg.program.account.promotora.fetch(promotoraPda);

  const nextRecintoId = toNum(promotora.nextRecintoId);
  const recintoPda = pdaRecinto(promotoraPda, recintoId, nextRecintoId);

  const tx = await pg.program.methods
    .creaRecinto(recintoId, nombre, new BN(capMax))
    .accounts({
      owner,
      promotora: promotoraPda,
      recinto: recintoPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log("Tx creaRecinto:", tx);
  console.log(
    "Recinto creado PDA:",
    recintoPda.toBase58(),
    "num:",
    nextRecintoId
  );
  return recintoPda;
}

/**
 * Crea evento en un recinto elegido por recinto_id (string).
 */
async function crearEvento(params: {
  recintoId: string;
  nombre: string;
  yyyy: number;
  mm: number;
  dd: number;
  bloque: keyof typeof Bloque;
}) {
  const recintoPk = await getKeyRecinto(params.recintoId);
  const bloqueInfo = Bloque[params.bloque];
  const eventoPk = pdaEvento(
    recintoPk,
    params.yyyy,
    params.mm,
    params.dd,
    bloqueInfo.u8
  );

  const tx = await pg.program.methods
    .creaEvento(
      params.nombre,
      params.yyyy,
      params.mm,
      params.dd,
      bloqueInfo.arg
    )
    .accounts({
      owner,
      recinto: recintoPk,
      evento: eventoPk,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log("Tx creaEvento:", tx);
  console.log("Evento creado PDA:", eventoPk.toBase58());
  return eventoPk;
}

/**
 * Cancela evento por (recinto_id, fecha, bloque) sin pedir pubkeys.
 */
async function cancelarEventoPorPda(eventoPdaStr: string, motivo: string) {
  if (!eventoPdaStr || eventoPdaStr.trim().length === 0) {
    throw new Error("eventoPdaStr es requerido.");
  }
  if (!motivo || motivo.trim().length === 0) {
    throw new Error("motivo es requerido.");
  }

  const eventoPk = new web3.PublicKey(eventoPdaStr);

  const tx = await pg.program.methods
    .cancelaEvento(motivo)
    .accounts({
      owner,
      evento: eventoPk,
    })
    .rpc();

  console.log("Tx cancelaEvento:", tx);
}

/**
 * Elimina (close) el recinto por recinto_id.
 * Internamente obtiene la pubkey del recinto (más reciente si hay duplicados).
 */
async function eliminarRecinto(recintoId: string) {
  const recintoPk = await getKeyRecinto(recintoId);

  const tx = await pg.program.methods
    .eliminaRecinto()
    .accounts({
      owner,
      recinto: recintoPk,
    })
    .rpc();

  console.log("Tx eliminaRecinto:", tx);
}

//////////////////// DEMO (elige lo que quieres ejecutar) ////////////////////

// 1) Asegurar promotora
// await ensurePromotora("OCESA Demo");

// 2) Ver nombre de promotora
await showPromotoraName();

// 3) Listar recintos
await listRecintos();

// 4) Crear un recinto (si quieres)
await crearRecinto("plaza-toros", "Plaza de toros", 4000);

// 5) Crear evento por recinto_id
/*await crearEvento({
  recintoId: "estadio-azteca",
  nombre: "Partido Necaxa vs America",
  yyyy: 2026,
  mm: 3,
  dd: 13,
  bloque: "matutino",
});*/

// 6) Listar eventos del recinto elegido
//const recintoPk = await getKeyRecinto("estadio-azteca");
//await listEventosByRecinto(recintoPk);

// 7) Cancelar evento por recinto_id + fecha + bloque
/*await cancelarEventoPorPda(
  "EJG79hv6kWoCV5zSXVs7KdnHKA74NRAJAKqR3Ej8x9bu",
  "Error en escritura",
);*/

// 8) Eliminar (close) recinto por recinto_id
// await eliminarRecinto("auditorio-nacional");
