// src/__tests__/example.test.ts

// Ce test simple vérifie que Jest fonctionne
test('addition simple', () => {
  expect(1 + 1).toBe(2)
})

// Vous pouvez aussi tester des fonctions de votre code
const maFonction = (name: string) => `Hello, ${name}`

test('teste maFonction', () => {
  expect(maFonction('Ibticar')).toBe('Hello, Ibticar')
})