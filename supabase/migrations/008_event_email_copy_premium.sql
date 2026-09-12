-- ============================================================
-- JAVA TIMES CAFFÉ · PREMIUM EVENT EMAIL COPY
-- Migration 008
-- Updates customer-facing copy only. No rule cadence changes.
-- ============================================================

update public.event_email_templates
set
  subject_template = 'Tu evento Java se acerca · saldo pendiente {{remaining}}',
  body_template = 'Hola {{customer_name}}.\n\nTu Java Coffee Cart está programado para el {{event_date}}.\n\nSaldo pendiente: {{remaining}}\nFecha límite para liquidar: {{due_date}}\n\nUsa el botón de pago de este correo para dejar tu evento completamente liquidado.\n\nPuedes revisar los detalles y pagos de tu evento aquí:\n{{confirmation_url}}\n\nGracias por elegir Java Times Caffé.',
  updated_at = now()
where code = 'BALANCE_REMINDER';

update public.event_email_templates
set
  subject_template = 'Recibimos tu solicitud de Java Coffee Cart · {{event_ref}}',
  body_template = 'Hola {{customer_name}}.\n\nRecibimos los datos de tu evento Java Coffee Cart.\n\nTu fecha todavía no está confirmada. La reservación queda confirmada cuando se completa el anticipo correspondiente.\n\nFecha del evento: {{event_date}}\nTotal cotizado: {{total}}\nAnticipo requerido: {{deposit}}\n\nContinúa tu reservación aquí:\n{{confirmation_url}}\n\nSi la fecha continúa disponible, podrás completar el anticipo y dejarla apartada.',
  updated_at = now()
where code = 'RESERVATION_UNPAID';

update public.event_email_templates
set
  subject_template = '¿Aún estás planeando tu evento con Java Coffee Cart?',
  body_template = 'Hola {{customer_name}}.\n\nHace un tiempo cotizaste Java Coffee Cart y tu reservación no se confirmó.\n\nSi tu evento sigue en pie, puedes revisar fechas disponibles y crear una nueva cotización aquí:\n{{quote_url}}\n\nJava lleva el Coffee Cart, equipo, montaje, personal y servicio de bebidas para tus invitados.\n\nSi ya no deseas recibir estos recordatorios:\n{{unsubscribe_url}}',
  updated_at = now()
where code = 'MONTHLY_REACTIVATION';
