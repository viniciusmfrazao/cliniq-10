// Geradores de dados sintéticos pra testes de stress
// Tudo aqui é pseudo-aleatório e reproduzível com SEED se quiser

const NAMES = [
  'Maria Silva', 'Ana Souza', 'Beatriz Costa', 'Carla Mendes', 'Daniela Reis',
  'Eduarda Lima', 'Fernanda Oliveira', 'Gabriela Santos', 'Helena Pereira',
  'Isabela Almeida', 'Juliana Carvalho', 'Karen Ferreira', 'Larissa Rodrigues',
  'Mariana Gomes', 'Natalia Ribeiro', 'Patricia Martins', 'Renata Araújo',
  'Sabrina Barbosa', 'Tatiana Cardoso', 'Vanessa Nunes',
];

const PROCEDURES = [
  'Botox', 'Preenchimento labial', 'Limpeza de pele', 'Drenagem linfática',
  'Massagem modeladora', 'Microagulhamento', 'Peeling químico', 'Harmonização facial',
  'Bichectomia', 'Skinbooster', 'Toxina botulínica', 'Hidratação facial',
];

const QUESTIONS = [
  'Oi, qto custa o {p}?',
  'Bom dia! Vocês fazem {p}?',
  'Olá, gostaria de saber sobre {p}',
  'Quero marcar {p}, qual horário tem essa semana?',
  'Quanto fica o {p} parcelado?',
  'Vocês atendem aos sábados?',
  'Tem horário pra hoje?',
  'É a primeira vez que faço, é dolorido?',
  'Posso ir agora?',
  'Vocês aceitam PIX?',
];

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomPhone() {
  // ⚠️ IMPORTANTE: NUNCA gerar números que possam coincidir com gente real.
  // Usamos DDD "00" (não existe no Brasil) + 9 dígitos fake. A Evolution
  // rejeita o envio antes mesmo de tentar entregar, mas o webhook reconhece
  // como STRESSTEST_* via messageId e descarta antes de criar lead.
  //
  // Formato: 55 + 00 + 9 + 8 dígitos aleatórios = 5500900000000 .. 5500999999999
  const num = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  return `55009${num}`;
}

export function randomMessage() {
  const proc = pick(PROCEDURES);
  const tpl = pick(QUESTIONS);
  return tpl.replace('{p}', proc);
}

export function randomName() {
  return pick(NAMES);
}

/**
 * Gera um payload Evolution v2 do tipo MESSAGES_UPSERT (mensagem chegando)
 * Compatível com o webhook /api/webhooks/evolution/[instance]
 */
export function buildEvolutionMessageBody(instance, opts = {}) {
  const phone = opts.phone || randomPhone();
  const text = opts.text || randomMessage();
  const messageId = `STRESSTEST_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  return JSON.stringify({
    event: 'MESSAGES_UPSERT',
    instance,
    data: {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`,
        fromMe: false,
        id: messageId,
      },
      pushName: opts.name || randomName(),
      message: {
        conversation: text,
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      messageType: 'conversation',
    },
    date_time: new Date().toISOString(),
  });
}
