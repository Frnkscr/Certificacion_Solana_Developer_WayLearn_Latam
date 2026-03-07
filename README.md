# Certificacion_Solana_Developer_WayLearn_Latam
Proyecto de certificación para Solana
# Promotora (Solana + Anchor) — Demo de jerarquía de cuentas con PDAs

Este proyecto es una práctica guiada para aprender **Solana + Anchor** modelando un negocio de eventos (conciertos/teatro). La meta es entender el flujo completo:

- diseñar **cuentas on-chain**
- definir **PDAs con seeds**
- crear relaciones jerárquicas (Promotora → Recintos → Eventos)
- ejecutar operaciones desde un **client.ts amigable** (aceptando strings y resolviendo Pubkeys internamente)

---

## 1) Modelo de negocio (qué representa cada cuenta)

### ✅ Promotora
Representa a la “empresa” u organización que administra recintos y publica eventos.

Campos clave:
- `owner`: wallet administradora (quien puede crear recintos/eventos y cancelar)
- `nombre_promotora`: nombre visible
- `activo`: bandera para habilitar/deshabilitar
- `next_recinto_id`: contador incremental para crear recintos sin colisiones

**Decisión**: *1 wallet = 1 promotora*  
Esto se logra con una PDA derivada solo con la wallet del owner (ver Seeds).

---

### ✅ Recinto
Representa un lugar físico (auditorio/teatro).

Campos clave:
- `owner`: wallet administradora
- `promotora_pda`: referencia a la promotora dueña
- `recinto_id`: string corto (slug) amigable (ej. `"auditorio-nacional"`)
- `recinto_nombre`: nombre visible
- `recinto_num`: consecutivo “histórico” (qué número de recinto fue creado para esa promotora)
- `capacidad_maxima`: capacidad total (para validaciones futuras)
- `activo`: habilitado/deshabilitado

**Decisión**: `recinto_id` es “amigable”, pero el **consecutivo** garantiza unicidad incluso si se repite el `recinto_id` por error o pruebas.

---

### ✅ Evento
Representa un evento dentro de un recinto.

Campos clave:
- `owner`: wallet administradora
- `recinto_pda`: referencia al recinto
- `nombre_evento`: nombre visible
- fecha: `yyyy`, `mm`, `dd`
- `bloque_horario`: `u8` (0/1/2) derivado de un enum `BloqueHorario`
- `cancelado`: bandera
- `motivo_cancelacion`: string (máx 120)

**Decisión**: el evento es único por:
- recinto
- fecha
- bloque (Matutino/Vespertina/Nocturno)

Esto evita entrar en complejidad de timestamps/timezones para este aprendizaje.

---

## 2) PDAs y Seeds (por qué y para qué)

En Solana, una **PDA** es una dirección determinista derivada de:

- `program_id`
- `seeds`
- `bump` (calculado por el runtime / Anchor)

La ventaja es que **no necesitas guardar direcciones**: puedes recalcularlas siempre con la misma receta.

---

### PDA de Promotora

**Seeds:**
- `"promotora"`
- `owner_pubkey`

```text
PDA(promotora) = ["promotora", owner]
