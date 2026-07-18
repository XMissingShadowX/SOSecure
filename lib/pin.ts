// El hasheo y la verificación del PIN ya no ocurren en el cliente.
// Ver app/api/pin/route.ts (bcrypt.hash server-side) y app/api/pin/verify/route.ts
// (bcrypt.compare server-side, con rate limiting).
