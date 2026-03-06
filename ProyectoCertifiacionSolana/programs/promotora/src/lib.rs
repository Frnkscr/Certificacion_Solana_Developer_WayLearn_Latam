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
            _id:String,  
            _nombre: String,
            cap_max: u32,
            ) -> Result<()>{
        require!(!_id.trim().is_empty(), Errores::RecintoIdVacio);
        require!(_id.as_bytes().len() <= 32, Errores::RecintoIdLargo);
        require!(!_nombre.trim().is_empty(),Errores::RecintoNombreVacio);
        require!(cap_max != 0,Errores::CapacidadMaxVacia);

        let owner_id = ctx.accounts.owner.key();
        let promotora = &mut ctx.accounts.promotora;
        let num = promotora.next_recinto_id;

        let recinto = Recinto {
            owner: owner_id,
            promotora_pda: promotora.key(),
            recinto_id : _id,
            recinto_nombre: _nombre.clone(),
            recinto_num: num,
            capacidad_maxima: cap_max,
            activo: true,
        };

        ctx.accounts.recinto.set_inner(recinto);

        msg!(
            "Recinto {}, Creado con exito. Owner id: {}",
            _nombre,
            owner_id
        );
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

#[account]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BloqueHorario {
    Matutino, // 0
    Vespertina, // 1
    Nocturno, // 2
}
 
#[account]
#[derive(InitSpace)]
pub struct Evento {
    pub owner:Pubkey,
    pub recinto_pda:Pubkey,
    #[max_len(100)]
    pub nombre_evento:String,
    pub fecha_evento_yyyy:u16,
    pub fecha_evento_mm:u8,
    pub fecha_evento_dd:u8,
    pub bloque_horario: BloqueHorario,
    #[max_len(8)]
    pub hora_evento:String,
    pub cancelado: bool,
    #[max_len(120)]
    pub motivo_cancelacion:String,
}


impl BloqueHorario {
    pub fn as_u8(&self)-> u8 {
        match self {
            BloqueHorario::Matutino => 0,
            BloqueHorario::Vespertina => 1,
            BloqueHorario::Nocturno => 2,
        }
    }
}

//-------------------------------------
//-------------------------------------
//Cuentas -> Seeds
//-------------------------------------
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

#[derive(Accounts)]
#[instruction(yyyy: u16, mm:u8, dd:u8, bloque:BloqueHorario)]
pub struct NuevoEvento<'info>{
    #[account(mut)]
    pub owner: Signer<'info>,
    pub recinto: Account<'info, Recinto>,
    #[account(
        init,
        payer = owner,
        space = Evento::INIT_SPACE+8,
        seeds = [
            b"evento",
            recinto.key().as_ref(),
            &yyyy.to_le_bytes(),
            &[mm],
            &[dd],
            &[bloque.as_u8()]
        ],
        bump
    )]
    pub evento: Account<'info, Evento>,
    pub system_program: Program<'info, System>,
}


