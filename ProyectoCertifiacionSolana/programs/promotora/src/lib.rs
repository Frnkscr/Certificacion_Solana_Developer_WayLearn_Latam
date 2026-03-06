use anchor_lang::prelude::*;

declare_id!("6qJKB78omVyruyeXCwVdoHG1isTyoWZWjiXpm4DwRLQq");

#[program]
pub mod promotora {
    use super::*;
    pub fn crea_promotora(ctx: Context<NuevaPromotora>,nombre:String) -> Result<()>{
        require!(!nombre.trim().is_empty(), Errores::NombreVacio);
        let owner_id = ctx.accounts.owner.key();
        let promotora = Promotora {
            owner: owner_id,
            nombre_promotora : nombre.clone(),
            activo : true,
            next_recinto_id : 0,
        };

        ctx.accounts.promotora.set_inner(promotora);

        msg!(
            "Promotora {}, Creada con exito. Owner id: {}",
            nombre,
            owner_id
        );
        Ok(())

    }

    pub fn crea_recinto(
            ctx: Context<NuevoRecinto>, 
            recinto_id:String,  
            recinto_nombre: String,
            capacidad_max: u32,
            ) -> Result<()>{
        require!(!recinto_id.trim().is_empty(), Errores::RecintoIdVacio);
        require!(recinto_id.as_bytes().len() <= 32, Errores::RecintoIdLargo);
        require!(!recinto_nombre.trim().is_empty(),Errores::RecintoNombreVacio);
        require!(capacidad_max != 0,Errores::CapacidadMaxVacia);

        let promotora = &mut ctx.accounts.promotora;
        let recinto = &mut ctx.accounts.recinto;

        let num = promotora.next_recinto_id;

        recinto.owner = ctx.accounts.owner.key();
        recinto.promotora_pda = promotora.key();
        recinto.recinto_id = recinto_id;
        recinto.recinto_nombre = recinto_nombre;
        recinto.recinto_num = num;
        recinto.capacidad_maxima = capacidad_max;
        recinto.activo = true;
        //Guardamos el id en la promotora para llevar el consecutivo
        promotora.next_recinto_id = promotora.next_recinto_id.checked_add(1).unwrap();

        Ok(())
    }
}

#[error_code]
pub enum Errores {
    #[msg("Error, el nombre no puede ser vacio")]
    NombreVacio,
    #[msg("Error, el recinto id no puede ser vacio")]
    RecintoIdVacio,
    #[msg("Error, el recinto id es muy largo")]
    RecintoIdLargo,
    #[msg("Error, el recinto nombre no puede ser vacio")]
    RecintoNombreVacio,
    #[msg("Error, la capacidad no puede ser vacio o igual a 0")]
    CapacidadMaxVacia,
} 
/* Estructuras de cuentas
*/ 
//Promotoras, empresas que agrupan y administran los resintos
//Permite tener diferetes recintos reptidos cambiando la promotora
//1. qué cuentas existirán (Empresa, Evento, Comprador del boleto)
//2. Quien es el dueño de cada una (Promotora, Resevca de evento, compradores de boletos)
#[account]
#[derive(InitSpace)]
pub struct Promotora {
    pub owner:Pubkey,
    #[max_len(60)]
    pub nombre_promotora: String,
    pub activo: bool,
    pub next_recinto_id:u64,
}

#[account]
#[derive(InitSpace)]
pub struct Recinto {
    pub owner:Pubkey,
    pub promotora_pda: Pubkey,
    #[max_len(32)]
    pub recinto_id: String, //codigo unico para identificar recintos sin poner un nombre especifico
    #[max_len(60)]
    pub recinto_nombre: String, //Nombre del recinto 
    pub recinto_num: u64, //Identifica cual es el numero y en que momento se creo para cada promotora
    pub capacidad_maxima: u32, // Para validar al momento de crear las secciónes y no exceder la capacidad.
    pub activo: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Seccion {
    pub owner:Pubkey,
    pub recinto_pda:Pubkey,
    #[max_len(60)]
    pub seccion_nombre: String,//General - A 
    #[max_len(6)]
    pub seccion_id: String,
    pub capacidad: u32,
    pub activo: bool,
}


//Cuentas -> Seeds
#[derive(Accounts)]
pub struct NuevaPromotora<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init, 
        payer = owner, 
        space = Promotora::INIT_SPACE + 8,
        seeds = [b"promotora", owner.key().as_ref()],
        bump
    )] 
    pub promotora: Account<'info, Promotora>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(recinto_id:String )]
pub struct NuevoRecinto<'info>{
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"promotora",owner.key().as_ref()],
        bump 
    )]
    pub promotora : Account<'info, Promotora>,

    #[account(
        init,
        payer = owner,
        space = Recinto::INIT_SPACE + 8,
        seeds = [
            b"recinto",
            promotora.key().as_ref(),
            recinto_id.as_bytes(),
            &promotora.next_recinto_id.to_le_bytes()
        ],
        bump
    )]
    pub recinto: Account<'info, Recinto>,
    pub system_program: Program<'info, System>,
}





/* 
#[account]
#[derive(InitSpace)]
pub struct Evento {
    owner:Pubkey,
    recinto_pda:Pubkey,
    #[max_len(100)]
    nombre_evento:String,
    fecha_evento_yyyy:u16,
    fecha_evento_mm:u16,
    fecha_evento_dd:u16,
}
*/
