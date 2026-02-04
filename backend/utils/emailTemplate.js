// Template d'email d'invitation

const generateInvitationEmail = (guest, invitationLink) => {
  const events = [];
  if (guest.invited_to_mairie) events.push('La Mairie');
  if (guest.invited_to_vin_honneur) events.push('Vin d\'Honneur / Henné');
  if (guest.invited_to_chabbat) events.push('Le Chabbat');
  if (guest.invited_to_houppa) events.push('Houppa / Soirée');

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation au Mariage</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Georgia', 'Times New Roman', serif;
          background-color: #f5f5f5;
          line-height: 1.6;
        }
        .wrapper {
          background-color: #f5f5f5;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          background: linear-gradient(135deg, #d4af37 0%, #c4a035 100%);
          color: #ffffff;
          padding: 40px 20px;
        }
        .header h1 {
          font-size: 42px;
          font-style: italic;
          margin-bottom: 10px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .header p {
          font-size: 18px;
          opacity: 0.9;
        }
        .content {
          color: #333333;
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          margin-bottom: 25px;
        }
        .events {
          background-color: #faf8f5;
          padding: 20px;
          margin: 25px 0;
          border-left: 4px solid #d4af37;
          border-radius: 0 8px 8px 0;
        }
        .events-title {
          font-weight: bold;
          color: #d4af37;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .events ul {
          list-style: none;
          padding-left: 0;
        }
        .events li {
          padding: 8px 0;
          border-bottom: 1px solid #e0e0e0;
          font-size: 15px;
        }
        .events li:last-child {
          border-bottom: none;
        }
        .events li:before {
          content: "✦ ";
          color: #d4af37;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #d4af37 0%, #c4a035 100%);
          color: #ffffff !important;
          padding: 16px 40px;
          text-decoration: none;
          border-radius: 50px;
          font-size: 16px;
          font-weight: bold;
          letter-spacing: 1px;
          box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
          transition: all 0.3s ease;
        }
        .signature {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          font-style: italic;
        }
        .signature strong {
          color: #d4af37;
          font-size: 20px;
        }
        .footer {
          text-align: center;
          background-color: #f8f8f8;
          color: #888888;
          font-size: 12px;
          padding: 20px;
          border-top: 1px solid #e0e0e0;
        }
        .footer p {
          margin: 5px 0;
        }
        .decoration {
          text-align: center;
          color: #d4af37;
          font-size: 24px;
          letter-spacing: 10px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>Dvora & Nathan</h1>
            <p>14 Juin 2026</p>
          </div>

          <div class="content">
            <p class="greeting">Cher(ère) <strong>${guest.first_name} ${guest.last_name}</strong>,</p>

            <p class="message">
              C'est avec une immense joie que nous vous invitons à célébrer notre mariage.
              Ce jour si spécial ne serait pas complet sans votre présence.
            </p>

            <div class="decoration">✦ ✦ ✦</div>

            <div class="events">
              <p class="events-title">Vous êtes convié(e) aux événements suivants :</p>
              <ul>
                ${events.map(event => `<li>${event}</li>`).join('')}
              </ul>
            </div>

            <p class="message">
              Pour consulter tous les détails de votre invitation personnalisée
              et confirmer votre présence, veuillez cliquer sur le bouton ci-dessous :
            </p>

            <div class="button-container">
              <a href="${invitationLink}" class="button">VOIR MON INVITATION</a>
            </div>

            <p class="message">
              Nous avons hâte de partager ce moment unique avec vous !
            </p>

            <div class="signature">
              <p>Avec toute notre affection,</p>
              <p><strong>Dvora & Nathan</strong></p>
            </div>
          </div>

          <div class="footer">
            <p>Ce lien d'invitation est personnel et unique.</p>
            <p>Ne le partagez pas.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Template email texte (fallback)
const generateInvitationEmailText = (guest, invitationLink) => {
  const events = [];
  if (guest.invited_to_mairie) events.push('- La Mairie');
  if (guest.invited_to_vin_honneur) events.push('- Vin d\'Honneur / Henné');
  if (guest.invited_to_chabbat) events.push('- Le Chabbat');
  if (guest.invited_to_houppa) events.push('- Houppa / Soirée');

  return `
Cher(ère) ${guest.first_name} ${guest.last_name},

C'est avec une immense joie que nous vous invitons à célébrer notre mariage le 14 Juin 2026.

Vous êtes convié(e) aux événements suivants :
${events.join('\n')}

Pour consulter tous les détails de votre invitation personnalisée et confirmer votre présence, veuillez cliquer sur le lien suivant :

${invitationLink}

Nous avons hâte de partager ce moment unique avec vous !

Avec toute notre affection,
Dvora & Nathan

---
Ce lien d'invitation est personnel et unique. Ne le partagez pas.
  `.trim();
};

module.exports = {
  generateInvitationEmail,
  generateInvitationEmailText
};
