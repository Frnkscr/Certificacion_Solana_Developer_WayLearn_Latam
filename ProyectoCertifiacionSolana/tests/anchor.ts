import * as anchor from "@coral-xyz/anchor";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import type { Promotora } from "../target/types/promotora";
describe("promotora", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Promotora as anchor.Program<Promotora>;
  
  it("crea una promotora PDA", async () => {
    const owner = program.provider.publicKey;
    const nombre = "MusicVibe Demo";

    // Derivar la PDA con las mismas seeds del programa:
    // [b"promotora", owner.key().as_ref()]
    const [promotoraPda, bump] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("promotora"),
        owner.toBuffer(),
      ],
      program.programId
    );

    console.log("Owner:", owner.toBase58());
    console.log("Promotora PDA:", promotoraPda.toBase58());
    console.log("Bump:", bump);

    // Invocar la instrucción
    const txHash = await program.methods
      .creaPromotora(nombre)
      .accounts({
        owner,
        promotora: promotoraPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`Tx: ${txHash}`);
    await program.provider.connection.confirmTransaction(txHash);

    // Leer la cuenta creada
    const promotora = await program.account.promotora.fetch(promotoraPda);

    console.log("Datos on-chain:", promotora);

    // Validaciones
    assert.equal(promotora.owner.toBase58(), owner.toBase58());
    assert.equal(promotora.nombrePromotora, nombre);
    assert.equal(promotora.activo, true);
    assert.equal(promotora.bump, bump);
  });
});