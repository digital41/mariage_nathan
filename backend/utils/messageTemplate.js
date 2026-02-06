// Templates de messages pour SMS et WhatsApp

// Formater le numero de telephone au format international
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-.()]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '33' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
};

// Formater pour lien wa.me (sans le +)
const formatPhoneForWhatsApp = (phone) => {
  const formatted = formatPhoneNumber(phone);
  if (!formatted) return null;
  return formatted.replace('+', '');
};

// Generer le message WhatsApp
const generateWhatsAppMessage = (guest, invitationLink) => {
  const events = [];
  if (guest.invited_to_mairie) events.push('La Mairie');
  if (guest.invited_to_vin_honneur) events.push('Vin d\'Honneur / Henne');
  if (guest.invited_to_chabbat) events.push('Le Chabbat');
  if (guest.invited_to_houppa) events.push('Houppa / Soiree');

  const lines = [
    'Bonjour ' + guest.first_name + ' !',
    '',
    'C\'est avec une immense joie que nous vous invitons au mariage de *Dvora & Nathan* le *14 juin 2026*',
    '',
    'Vous etes chaleureusement convie(e) a :'
  ];

  events.forEach(function(e) {
    lines.push('- ' + e);
  });

  lines.push('');
  lines.push('Consultez votre invitation personnalisee et confirmez votre presence ici :');
  lines.push(invitationLink);
  lines.push('');
  lines.push('Nous avons hate de partager ce moment magique avec vous !');
  lines.push('');
  lines.push('_Dvora & Nathan_');

  return lines.join('\n');
};

// Generer le message SMS
const generateSMSMessage = (guest, invitationLink) => {
  return 'Bonjour ' + guest.first_name + ' ! Dvora & Nathan vous invitent a leur mariage le 14 Juin 2026. Confirmez votre presence : ' + invitationLink;
};

// Generer le lien WhatsApp
const generateWhatsAppLink = (guest, invitationLink) => {
  const phone = formatPhoneForWhatsApp(guest.phone);
  if (!phone) return null;
  const message = generateWhatsAppMessage(guest, invitationLink);
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
};

// Generer le lien SMS
const generateSMSLink = (guest, invitationLink) => {
  const phone = formatPhoneNumber(guest.phone);
  if (!phone) return null;
  const message = generateSMSMessage(guest, invitationLink);
  return 'sms:' + phone + '?body=' + encodeURIComponent(message);
};

module.exports = {
  formatPhoneNumber,
  formatPhoneForWhatsApp,
  generateWhatsAppMessage,
  generateSMSMessage,
  generateWhatsAppLink,
  generateSMSLink
};
