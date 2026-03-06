import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import type { Promotora } from "../target/types/promotora";
describe("recintos", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Promotora as anchor.Program<Promotora>;
  
  it("crea 1 recinto y confirma incrementos", async () => {
    const owner = program.provider.publicKey;

    // 1) Derivar PDA de promotora
    const [promotoraPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("promotora"), owner.toBuffer()],
      program.programId
    );

    // 2) Intentar fetch de promotora; si no existe, crearla
    let promotora: any;
    try {
      promotora = await program.account.promotora.fetch(promotoraPda);
      console.log("Promotora ya existe:", promotoraPda.toBase58());
    } catch (e) {
      console.log("Promotora no existe, creando...");
      const tx = await program.methods
        .creaPromotora("MusicVibe Demo")
        .accounts({
          owner,
          promotora: promotoraPda,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      await program.provider.connection.confirmTransaction(tx);
      promotora = await program.account.promotora.fetch(promotoraPda);
    }

    // 3) Leer el contador actual (esto es CLAVE para derivar la PDA de recinto)
    const nextRecintoIdBn = promotora.nextRecintoId; // suele venir como BN
    const nextRecintoIdNum = nextRecintoIdBn.toNumber();

    console.log("nextRecintoId actual:", nextRecintoIdNum);

    // 4) Preparar datos para el recinto
    const recintoId = "MusicVibe-Ar_Ci_Me"; // <= 32 bytes
    const recintoNombre = "Arena Ciudad de México";
    const capacidadMax = new BN(10000);

    // 5) Derivar PDA de recinto con tus seeds:
    // [ "recinto", promotora, recinto_id, next_recinto_id ]
    const [recintoPda, recintoBump] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("recinto"),
        promotoraPda.toBuffer(),
        Buffer.from(recintoId),
        // u64 little-endian (8 bytes)
        new BN(nextRecintoIdNum).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    console.log("Recinto PDA:", recintoPda.toBase58());
    console.log("Recinto bump:", recintoBump);

    // 6) Crear recinto
    const tx2 = await program.methods
      .creaRecinto(recintoId, recintoNombre, capacidadMax)
      .accounts({
        owner,
        promotora: promotoraPda,
        recinto: recintoPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(tx2);

    // 7) Validar recinto on-chain
    const recinto = await program.account.recinto.fetch(recintoPda);
    assert.equal(recinto.owner.toBase58(), owner.toBase58());
    assert.equal(recinto.promotoraPda.toBase58(), promotoraPda.toBase58());
    assert.equal(recinto.recintoId, recintoId);
    assert.equal(recinto.recintoNombre, recintoNombre);
    assert.equal(recinto.recintoNum, nextRecintoIdNum);
    assert.equal(recinto.capacidadMaxima, 10000);
    assert.equal(recinto.activo, true);
    assert.equal(recinto.bump, recintoBump);

    // 8) Validar que el contador incrementó en la promotora
    const promotoraAfter = await program.account.promotora.fetch(promotoraPda);
    assert.equal(promotoraAfter.nextRecintoId, nextRecintoIdNum + 1);
  });
});