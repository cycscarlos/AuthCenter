--Alta manual del PRIMER ADMIN (reemplazar -- <UUID_AUTH_USER> y datos):
 INSERT INTO public.usuarios (id, email, nombre, rol)
 VALUES ('d830e483-1a13-490a-a2b7-018f75640fa8', 'alchemy.zcoder@gmail.com', 'Carlos Colmenares A.', 'admin');

 -- Verificación opcional:
 SELECT email, rol, activo FROM public.usuarios;                                                                                           
                                                                                                          