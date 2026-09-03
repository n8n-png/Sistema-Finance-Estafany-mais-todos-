UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  encrypted_password = crypt('MaisTodos@2026', gen_salt('bf'))
WHERE email = 'estefany.gomes@maistodos.com.br';