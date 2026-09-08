# Validação do fluxo de agendamento

A página do paciente foi aberta com o fluxo atualizado. A primeira etapa mostra nove especialidades: Clínico Geral, Cardiologia, Pediatria, Dermatologia, Ortopedia, Psicologia, Nutrição, Ginecologia e Neurologia.

A lista de Neurologia apresenta dois profissionais, com CRM e unidades de atendimento. A seleção da especialidade e o avanço para a escolha do profissional funcionaram no navegador local. Como a Neurologia foi definida como presencial, a etapa seguinte deverá oferecer somente essa modalidade.

O ambiente local não possui a configuração do Supabase, então os testes de persistência e de consultas reais ficam limitados ao fluxo visual e aos dados mockados disponíveis no front-end.

Durante o teste, a posição dos botões mudou conforme a etapa foi renderizada; um clique voltou ao primeiro passo em vez de avançar. O fluxo continua recuperável pelo botão Continuar e a especialidade Neurologia permaneceu selecionada. A validação seguirá considerando os elementos visíveis em cada etapa.

Com Neurologia e o profissional selecionados, o fluxo avançou para “Escolha um dia e uma hora”. Os dias exibidos têm rótulos completos para leitores de tela, como “terça-feira, 08 de setembro”, e os horários ocupados permanecem desativados.

A escolha de data e horário foi validada. O primeiro horário disponível pôde ser selecionado, enquanto horários bloqueados apareceram desativados e com indicação acessível de indisponibilidade.

Na etapa “Como será sua consulta?”, Neurologia mostrou somente o cartão “Presencial”. Depois de escolher esse formato, a unidade do profissional apareceu separadamente, com nome e endereço. Isso remove a redundância e evita oferecer vídeo para uma especialidade que exige presença.

No teste de Psicologia, a lista passou a mostrar dois profissionais, com CRP e unidades distintas. A próxima etapa será usada para confirmar que a modalidade por vídeo aparece apenas aqui e não em Neurologia.

O teste de Psicologia avançou com dois profissionais, chegou à seleção de data e horário e manteve os horários disponíveis e bloqueados funcionando. A etapa de formato por vídeo será verificada após o avanço com o horário selecionado.

O caminho de Psicologia foi validado até o resumo: aparecem as opções Presencial e Por vídeo; ao escolher vídeo, a unidade física não é solicitada e o resumo mostra “Por vídeo — o link será enviado após a confirmação”.
