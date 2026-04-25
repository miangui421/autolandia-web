-- BACKUP: definición de registrar_venta_web ANTES de agregar UTMs + canal.
-- Fecha backup: 2026-04-24 (DEV project jyytukfcnembucompttu).
-- Existen DOS overloads:
--   (1) 11 params — versión histórica pre-3x1 (sin p_is_promo_3x1). No se usa desde el código actual.
--   (2) 12 params — versión activa con p_is_promo_3x1. Es la que invoca lib/sale-registrar.ts.
-- Si hay que rollback, aplicar ambos CREATE OR REPLACE para restaurar el estado previo.
-- NUNCA editar este archivo. Es histórico.

-- ─── Overload 1 (11 params, histórico) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_venta_web(p_cantidad integer, p_transaction_id text, p_nombre_completo text, p_ci text, p_telefono text, p_monto integer, p_comprobante_url text, p_metodo_pago text, p_telefono_registro text, p_mensaje_inicial text, p_numeros_especificos integer[] DEFAULT NULL::integer[])
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_ticket_id TEXT;
  v_venta_id INT;
  v_numeros_asignados TEXT;
  v_numeros INT[];
BEGIN
  SELECT 'TK-' || (COALESCE(MAX(CAST(SUBSTRING(ticket_id FROM '[0-9]+') AS INTEGER)), 999) + 1)
  INTO v_ticket_id FROM ventas;

  IF p_numeros_especificos IS NOT NULL AND array_length(p_numeros_especificos, 1) > 0 THEN
    SELECT array_agg(numero) INTO v_numeros
    FROM rifas
    WHERE numero = ANY(p_numeros_especificos)
      AND estado = 'LIBRE';

    IF array_length(v_numeros, 1) IS NULL OR array_length(v_numeros, 1) < p_cantidad THEN
      RAISE EXCEPTION 'Algunos numeros ya no estan disponibles';
    END IF;
  ELSE
    SELECT array_agg(numero) INTO v_numeros
    FROM (
      SELECT numero FROM rifas
      WHERE estado = 'LIBRE'
        AND (reservado_hasta IS NULL OR reservado_hasta < NOW())
      ORDER BY RANDOM()
      LIMIT p_cantidad
    ) sub;
  END IF;

  IF v_numeros IS NULL OR array_length(v_numeros, 1) < p_cantidad THEN
    RAISE EXCEPTION 'No hay suficientes numeros disponibles';
  END IF;

  INSERT INTO ventas (
    ticket_id, transaction_id, nombre_completo, ci, telefono,
    monto, cantidad, comprobante_url, metodo_pago, fecha,
    telefono_registro, numeros_asignados, mensaje_inicial
  ) VALUES (
    v_ticket_id, p_transaction_id, p_nombre_completo, p_ci, p_telefono,
    p_monto, p_cantidad, p_comprobante_url, p_metodo_pago, NOW(),
    p_telefono_registro, v_numeros, p_mensaje_inicial
  ) RETURNING id INTO v_venta_id;

  UPDATE rifas
  SET estado = 'VENDIDO', venta_id = v_venta_id, updated_at = NOW(), reservado_hasta = NULL
  WHERE numero = ANY(v_numeros);

  SELECT array_to_string(array_agg(LPAD(n::text, 5, '0') ORDER BY n), ', ')
  INTO v_numeros_asignados
  FROM unnest(v_numeros) AS n;

  RETURN json_build_object(
    'ticket_id', v_ticket_id,
    'numeros_asignados', v_numeros_asignados
  );
END;
$function$;

-- ─── Overload 2 (12 params, versión activa antes de UTMs) ───────────────────
CREATE OR REPLACE FUNCTION public.registrar_venta_web(p_cantidad integer, p_transaction_id text, p_nombre_completo text, p_ci text, p_telefono text, p_monto integer, p_comprobante_url text, p_metodo_pago text, p_telefono_registro text, p_mensaje_inicial text, p_numeros_especificos integer[] DEFAULT NULL::integer[], p_is_promo_3x1 boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_ticket_id TEXT;
  v_venta_id INT;
  v_numeros_asignados TEXT;
  v_numeros INT[];
BEGIN
  SELECT 'TK-' || (COALESCE(MAX(CAST(SUBSTRING(ticket_id FROM '[0-9]+') AS INTEGER)), 999) + 1)
  INTO v_ticket_id FROM ventas;

  IF p_numeros_especificos IS NOT NULL AND array_length(p_numeros_especificos, 1) > 0 THEN
    SELECT array_agg(numero) INTO v_numeros
    FROM rifas
    WHERE numero = ANY(p_numeros_especificos)
      AND estado = 'LIBRE';

    IF array_length(v_numeros, 1) IS NULL OR array_length(v_numeros, 1) < p_cantidad THEN
      RAISE EXCEPTION 'Algunos numeros ya no estan disponibles';
    END IF;
  ELSE
    SELECT array_agg(numero) INTO v_numeros
    FROM (
      SELECT numero FROM rifas
      WHERE estado = 'LIBRE'
        AND (reservado_hasta IS NULL OR reservado_hasta < NOW())
      ORDER BY RANDOM()
      LIMIT p_cantidad
    ) sub;
  END IF;

  IF v_numeros IS NULL OR array_length(v_numeros, 1) < p_cantidad THEN
    RAISE EXCEPTION 'No hay suficientes numeros disponibles';
  END IF;

  INSERT INTO ventas (
    ticket_id, transaction_id, nombre_completo, ci, telefono,
    monto, cantidad, comprobante_url, metodo_pago, fecha,
    telefono_registro, numeros_asignados, mensaje_inicial, is_promo_3x1
  ) VALUES (
    v_ticket_id, p_transaction_id, p_nombre_completo, p_ci, p_telefono,
    p_monto, p_cantidad, p_comprobante_url, p_metodo_pago, NOW(),
    p_telefono_registro, v_numeros, p_mensaje_inicial, COALESCE(p_is_promo_3x1, false)
  ) RETURNING id INTO v_venta_id;

  UPDATE rifas
  SET estado = 'VENDIDO', venta_id = v_venta_id, updated_at = NOW(), reservado_hasta = NULL
  WHERE numero = ANY(v_numeros);

  SELECT array_to_string(array_agg(LPAD(n::text, 5, '0') ORDER BY n), ', ')
  INTO v_numeros_asignados
  FROM unnest(v_numeros) AS n;

  RETURN json_build_object(
    'ticket_id', v_ticket_id,
    'numeros_asignados', v_numeros_asignados
  );
END;
$function$;
