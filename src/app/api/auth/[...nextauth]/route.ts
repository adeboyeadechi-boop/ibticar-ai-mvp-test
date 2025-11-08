// src/app/api/auth/[...nextauth]/route.ts

// Exporte les handlers GET et POST depuis notre config auth
export { handlers as GET, handlers as POST } from "@/auth"