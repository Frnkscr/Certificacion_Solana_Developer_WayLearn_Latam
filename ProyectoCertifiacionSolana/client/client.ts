import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import type { Promotora } from "../target/types/promotora";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.Promotora as anchor.Program<Promotora>;

// Client
console.log("My address:", program.provider.publicKey.toString());
const balance = await program.provider.connection.getBalance(program.provider.publicKey);
console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);

function getPromotoraPda(owner: web3.PublicKey, programId: web3.PublicKey) {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("promotora"), owner.toBuffer()],
    programId
  );
}

async function fetchPromotoraByOwner(owner: web3.PublicKey) {
  const [promotoraPda] = getPromotoraPda(owner, program.programId);

  try {
    const promotora = await program.account.promotora.fetch(promotoraPda);
    return { promotoraPda, promotora };
  } catch {
    return { promotoraPda, promotora: null };
  }
}

const res = await fetchPromotoraByOwner(program.provider.publicKey);
console.log(res.promotoraPda.toBase58(), res.promotora);


async function fetchRecintosByPromotora(promotoraPda: web3.PublicKey) {
  const recintos = await program.account.recinto.all([
    {
      memcmp: {
        offset: 40,
        bytes: promotoraPda.toBase58(),
      },
    },
  ]);

  // recintos viene como [{ publicKey, account }, ...]
  return recintos;
}

const owner = program.provider.publicKey;

const { promotoraPda, promotora } = await fetchPromotoraByOwner(owner);
if (!promotora) {
  console.log("No existe promotora para:", owner.toBase58());
} else {
  console.log("Promotora:", promotoraPda.toBase58(), promotora.nombrePromotora);

  const recintos = await fetchRecintosByPromotora(promotoraPda);
  console.log("Total recintos:", recintos.length);

  for (const r of recintos) {
    console.log(
      "Recinto PDA:", r.publicKey.toBase58(),
      "id:", r.account.recintoId,
      "nombre:", r.account.recintoNombre,
      "num:", typeof r.account.recintoNum === "number" ? r.account.recintoNum : r.account.recintoNum.toNumber()
    );
  }
}