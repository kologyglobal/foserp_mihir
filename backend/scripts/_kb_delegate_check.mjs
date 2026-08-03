import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()
try {
  console.log('knowledgeDocument', typeof p.knowledgeDocument)
  console.log('keys', Object.keys(p).filter((k) => k.toLowerCase().includes('knowledge')).join(','))
} finally {
  await p.$disconnect()
}
