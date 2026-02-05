// Templates de messages pour SMS et WhatsApp

// Formater le numéro de téléphone au format international
const formatPhoneNumber = (phone) => {
  if (!phone) return null;

  // Nettoyer le numéro
  let cleaned = phone.replace(/[\s\-.()]/g, '');

  // Si commence par 0, remplacer par +33 (France)
  if (cleaned.startsWith('0')) {
    cleaned = '33' + cleaned.substring(1);
  }

  // Ajouter + si pas présent
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

// Générer le message WhatsApp (plus détaillé)
const generateWhatsAppMessage = (guest, invitationLink) => {
  const events = [];
  if (guest.invited_to_mairie) events.push('La Mairie');
  if (guest.invited_to_vin_honneur) events.push('Vin d\'Honneur / Henné');
  if (guest.invited_to_chabbat) events.push('Le Chabbat');
  if (guest.invited_to_houppa) events.push('Houppa / Soirée');

  return [
    'Bonjour ' + guest.first_name + ' ! \u{1F48D}',
    '',
    'Nous avons le plaisir de vous inviter au mariage de *Dvora & Nathan* le *14 Juin 2026* !',
    '',
    'Vous etes convie(e) a :',
    ...events.map(e => '- ' + e),
    '',
    'Consultez votre invitation personnalisee et confirmez votre presence ici :',
    invitationLink,
    '',
    'Nous avons hate de partager ce moment avec vous !',
    '_Dvora & Nathan_ \u{1F49B}'
  ].join('\n');
};

// Générer le message SMS (plus court)
const generateSMSMessage = (guest, invitationLink) => {
  return `Bonjour ${guest.first_name} ! Dvora & Nathan vous invitent a leur mariage le 14 Juin 2026. Confirmez votre presence : ${invitationLink}`;
};

// Générer le lien WhatsApp
const generateWhatsAppLink = (guest, invitationLink) => {
  const phone = formatPhoneForWhatsApp(guest.phone);
  if (!phone) return null;

  const message = generateWhatsAppMessage(guest, invitationLink);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

// Générer le lien SMS
const generateSMSLink = (guest, invitationLink) => {
  const phone = formatPhoneNumber(guest.phone);
  if (!phone) return null;

  const message = generateSMSMessage(guest, invitationLink);
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
};

module.exports = {
  formatPhoneNumber,
  formatPhoneForWhatsApp,
  generateWhatsAppMessage,
  generateSMSMessage,
  generateWhatsAppLink,
  generateSMSLink
};
