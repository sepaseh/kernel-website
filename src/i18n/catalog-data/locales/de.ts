import type { WebsiteTranslationResource } from "../website-types.ts";

const messages = {
  account: "Konto",
  accountChangePassword: "Passwort ändern",
  accountCheckAgain: "Erneut prüfen",
  accountCurrentPassword: "Aktuelles Passwort",
  accountEmail: "E-Mail-Bestätigung",
  accountEmailLabel: "E-Mail",
  accountEmailText:
    "Fügen Sie eine E-Mail-Adresse hinzu und bestätigen Sie diese mit einem Code.",
  accountEmailVerified: "Ihre E-Mail-Adresse wurde bestätigt.",
  accountEyebrow: "Ihr Bereich",
  accountIntro: "Ein paar Angaben, die dieses Konto zu Ihrem machen.",
  accountLogout: "Abmelden",
  accountMobileHelp: "Mit Ihrer Mobilnummer melden Sie sich an.",
  accountPasswordText:
    "Verwenden Sie ein Passwort, das Sie nirgendwo sonst nutzen.",
  accountProfile: "Profil",
  accountProfileText: "Halten Sie Ihren Namen aktuell.",
  accountProfileUpdated: "Profil erfolgreich aktualisiert.",
  accountSaveProfile: "Profil speichern",
  accountSaveUsername: "Benutzernamen speichern",
  accountSessionError: "Ihr Konto konnte nicht geladen werden.",
  accountSessionLoading: "Ihre Sitzung wird geprüft…",
  accountTitle: "Hallo, {name}.",
  accountUsername: "Benutzername",
  accountUsernameHelp:
    "3–30 Kleinbuchstaben, Ziffern, Punkte, Bindestriche oder Unterstriche.",
  accountUsernameText:
    "Wählen Sie einen wiedererkennbaren Benutzernamen für Ihr Konto.",
  accountUsernameUpdated: "Benutzername erfolgreich aktualisiert.",
  accountVerifiedEmail: "Bestätigte E-Mail-Adresse: {email}",
  accountVerifyEmail: "E-Mail bestätigen",
  authAccountSideLabel: "Ein klarer Ausgangspunkt",
  authAccountSideText:
    "Ihr Profil, Ihre Einstellungen und Ihr nächster Schritt – alles an einem Ort.",
  authAccountSideTitle: "Etwas Struktur.\nViele Möglichkeiten.",
  authBackToLogin: "Zur Anmeldung",
  authHasAccount: "Sie haben bereits ein Konto?",
  authLoginText: "Melden Sie sich an, um Ihr Konto zu nutzen.",
  authLoginTitle: "Schön, dass Sie wieder da sind.",
  authLogoutSuccess: "Sie wurden abgemeldet.",
  authNoAccount: "Neu bei Kernel?",
  authPasswordChanged: "Passwort erfolgreich geändert.",
  authPasswordReset:
    "Ihr Passwort wurde zurückgesetzt. Melden Sie sich mit Ihrem neuen Passwort an.",
  authRecoveryText:
    "Fordern Sie einen Bestätigungscode an und wählen Sie anschließend ein neues Passwort.",
  authRecoveryTitle: "Zurück zu Ihrem Konto.",
  authRegisterText:
    "Erstellen Sie Ihr Konto mit einem Bestätigungscode für Ihre Mobilnummer.",
  authRegisterTitle: "Ein neuer Anfang.",
  authResetPassword: "Passwort zurücksetzen",
  authSessionExpired:
    "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
  backHome: "Zur Startseite",
  codeRequested: "Bestätigungscode angefordert.",
  confirmPassword: "Passwort bestätigen",
  feedbackCodeHelp:
    "Geben Sie den Code ein, der an diese Nummer gesendet wurde. Der Anwendungsbetreiber muss den Versand einrichten.",
  feedbackErrorText:
    "Ihre Angaben wurden nicht übermittelt. Versuchen Sie, die Seite erneut zu laden.",
  feedbackErrorTitle: "Diese Seite konnte nicht geladen werden.",
  feedbackNotFoundText:
    "Diese Seite wurde nicht gefunden. Kehren wir zum Ausgangspunkt zurück.",
  feedbackNotFoundTitle: "Ein wenig vom Weg abgekommen.",
  feedbackResendIn: "Erneut senden in {seconds} s",
  firstName: "Vorname",
  forgotPassword: "Passwort vergessen?",
  globalErrorHeading: "Website vorübergehend nicht verfügbar",
  globalErrorText:
    "Versuchen Sie es erneut oder wenden Sie sich an die Website-Administration.",
  globalErrorTitle: "Kernel — Website nicht verfügbar",
  home: "Startseite",
  homeBoundaryText:
    "Website, Verwaltungsoberfläche und API haben eigene Zuständigkeiten. Typisierte Schnittstellenverträge halten die Kommunikation zwischen ihnen eindeutig.",
  homeBoundaryTitle: "Klare Grenzen. Weniger Rätselraten.",
  homeCtaLabel: "Ihr nächster Schritt",
  homeCtaText:
    "Erstellen Sie ein Konto, um die verbundene Kontoverwaltung zu erkunden, oder melden Sie sich an, um fortzufahren.",
  homeCtaTitle: "Schaffen Sie etwas Raum\nfür das Nächste.",
  homeDetailFour: "Eine eigenständige API und Verwaltungsanwendung",
  homeDetailLabel: "Nach Ihren Vorstellungen",
  homeDetailOne: "Funktionsbezogene Ansichten und Formulare",
  homeDetailText:
    "Kernel liefert die Struktur. Fachbereich, Inhalte und Nutzungserlebnis gestalten Sie selbst. Beginnen Sie klein und richten Sie jede Funktion an einem tatsächlichen Bedarf aus.",
  homeDetailThree: "Serverseitig verwaltete Sitzungen und Kontobestätigung",
  homeDetailTitle: "Ein Fundament,\nkein fertiges Produkt.",
  homeDetailTwo:
    "Eine von Ihrer Administration festgelegte Sprache mit vollständigen Übersetzungskatalogen",
  homeExplore: "Das Fundament entdecken",
  homeEyebrow: "Ein Fundament für Ihre Anwendung",
  homeIdentityText:
    "Melden Sie sich an, verwalten Sie Ihr Profil und halten Sie Ihre Kontodaten aktuell. Die API verwaltet die Sitzungen, der Browser die Cookies.",
  homeIdentityTitle: "Identität, durchdacht verwaltet.",
  homeInterfaceText:
    "Responsive Layouts, barrierefreie Bedienelemente, eine anwendungsweite Sprache und ein dauerhaft gespeichertes helles oder dunkles Farbschema. Für Anpassungen gemacht.",
  homeInterfaceTitle: "Eine Oberfläche, die Raum lässt.",
  homeIntro:
    "Kernel verbindet Benutzerkonten, eine typisierte API und eine durchdachte Oberfläche. Ein praktischer Anfang mit Raum für Ihre eigenen Ideen.",
  homeNote:
    "Eigenständige Anwendungen. Ein gemeinsamer Schnittstellenvertrag. Ihre Richtung.",
  homeSectionLabel: "Das Fundament",
  homeSectionText:
    "Geben Sie jedem Teil Ihrer Anwendung eine klare Aufgabe. Treffen Sie wichtige Entscheidungen nah an dem Produkt, das Sie entwickeln.",
  homeSectionTitle: "Das Wesentliche,\nbereits verbunden.",
  homeTitle: "Mit Klarheit beginnen.",
  homeTitleAccent: "Das Nächste gestalten.",
  lastName: "Nachname",
  login: "Anmelden",
  metadataDescription:
    "Ein Anwendungsfundament mit eigenständiger Website, Verwaltungsoberfläche und API sowie klaren Zuständigkeiten.",
  metadataTitle: "Kernel — Ein klarer Ausgangspunkt",
  mobile: "Mobilnummer",
  mobileInvalid:
    "Geben Sie eine elfstellige Mobilnummer ein, die mit 09 beginnt.",
  networkError:
    "Die Anfrage konnte nicht abgeschlossen werden. Versuchen Sie es erneut.",
  newPassword: "Neues Passwort",
  otp: "Bestätigungscode",
  password: "Passwort",
  passwordHelp: "Verwenden Sie 8–128 Zeichen.",
  passwordMismatch: "Die Passwörter stimmen nicht überein.",
  pending: "Bitte warten…",
  register: "Konto erstellen",
  reload: "Neu laden",
  retry: "Erneut versuchen",
  sendCode: "Code senden",
  siteBuilt: "Mit klaren Grenzen entwickelt.",
  siteFooter: "Ein Ausgangspunkt für Ihre nächste Anwendung.",
  siteFoundation: "Das Fundament",
  siteSkip: "Zum Inhalt springen",
  siteTheme: "Farbschema wechseln",
  unexpectedError: "Ein unerwarteter Fehler ist aufgetreten.",
} satisfies WebsiteTranslationResource;

export default messages;
