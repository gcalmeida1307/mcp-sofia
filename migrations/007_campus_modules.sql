-- Campus module catalog. All modules use the same permission and knowledge
-- isolation rules; access is granted separately through user_module_access.
INSERT INTO knowledge_modules(slug, display_name, description)
VALUES
 ('recursos-humanos','Recursos Humanos','Pessoas, admissões, benefícios, desenvolvimento, ponto e políticas internas.'),
 ('contabilidade','Contabilidade','Registros contábeis, demonstrações, conciliação e obrigações.'),
 ('financeiro','Financeiro','Orçamento, contas, pagamentos, recebimentos e planejamento financeiro.'),
 ('juridico-trabalhista','Jurídico Trabalhista','Legislação, contratos, processos e rotinas trabalhistas.'),
 ('secretaria','Secretaria','Atendimento acadêmico, documentos, protocolos e comunicação institucional.'),
 ('cursos','Cursos','Cursos, disciplinas, ementas, calendários, turmas e materiais didáticos.'),
 ('biblioteca','Biblioteca','Acervo, catalogação, empréstimos, referências e pesquisa acadêmica.'),
 ('pesquisa-extensao','Pesquisa e Extensão','Projetos, bolsas, produção científica, extensão e indicadores acadêmicos.'),
 ('compras','Compras e Contratos','Cotações, fornecedores, licitações, contratos e acompanhamento de compras.')
ON CONFLICT(slug) DO UPDATE SET display_name=EXCLUDED.display_name, description=EXCLUDED.description, is_active=true, updated_at=now();
