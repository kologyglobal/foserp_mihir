import type { RouteObject } from 'react-router-dom'
import { KnowledgeHomePage } from '@/modules/knowledge/KnowledgeHomePage'
import { KnowledgeDocumentsPage } from '@/modules/knowledge/KnowledgeDocumentsPage'

export const knowledgeRouteChildren: RouteObject[] = [
  { path: 'knowledge', element: <KnowledgeHomePage /> },
  { path: 'knowledge/documents', element: <KnowledgeDocumentsPage /> },
]
