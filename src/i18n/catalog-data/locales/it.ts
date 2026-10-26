import type { WebsiteTranslationResource } from "../website-types.ts";

const messages = {
  account: "Account",
  accountChangePassword: "Cambia password",
  accountCheckAgain: "Verifica di nuovo",
  accountCurrentPassword: "Password attuale",
  accountEmail: "Verifica della posta elettronica",
  accountEmailLabel: "Posta elettronica",
  accountEmailText:
    "Aggiungi un indirizzo di posta elettronica e verificalo con un codice.",
  accountEmailVerified:
    "Il tuo indirizzo di posta elettronica è stato verificato.",
  accountEyebrow: "Il tuo spazio",
  accountIntro: "Qualche dettaglio per rendere questo account davvero tuo.",
  accountLogout: "Esci",
  accountMobileHelp:
    "Il numero di cellulare è il tuo identificativo di accesso.",
  accountPasswordText: "Usa una password che non utilizzi altrove.",
  accountProfile: "Profilo",
  accountProfileText: "Mantieni aggiornato il tuo nome.",
  accountProfileUpdated: "Il profilo è stato aggiornato correttamente.",
  accountSaveProfile: "Salva profilo",
  accountSaveUsername: "Salva nome utente",
  accountSessionError: "Non è stato possibile caricare il tuo account.",
  accountSessionLoading: "Verifica della sessione…",
  accountTitle: "Ciao, {name}.",
  accountUsername: "Nome utente",
  accountUsernameHelp:
    "Da 3 a 30 lettere minuscole, numeri, punti, trattini o trattini bassi.",
  accountUsernameText:
    "Scegli un nome utente riconoscibile per il tuo account.",
  accountUsernameUpdated: "Il nome utente è stato aggiornato correttamente.",
  accountVerifiedEmail: "Indirizzo di posta elettronica verificato: {email}",
  accountVerifyEmail: "Verifica la posta elettronica",
  authAccountSideLabel: "Un punto di partenza chiaro",
  authAccountSideText:
    "Il tuo profilo, le tue preferenze e il tuo prossimo passo, tutto in un unico posto.",
  authAccountSideTitle: "Un po’ di struttura.\nTante possibilità.",
  authBackToLogin: "Torna all’accesso",
  authHasAccount: "Hai già un account?",
  authLoginText: "Accedi per continuare nel tuo account.",
  authLoginTitle: "È un piacere rivederti.",
  authLogoutSuccess: "Hai effettuato la disconnessione.",
  authNoAccount: "È la tua prima volta su Kernel?",
  authPasswordChanged: "La password è stata modificata correttamente.",
  authPasswordReset:
    "La tua password è stata reimpostata. Accedi con la nuova password.",
  authRecoveryText:
    "Richiedi un codice di verifica, poi scegli una nuova password.",
  authRecoveryTitle: "Recuperiamo il tuo accesso.",
  authRegisterText:
    "Crea il tuo account con un codice di verifica del cellulare.",
  authRegisterTitle: "Un nuovo inizio.",
  authResetPassword: "Reimposta password",
  authSessionExpired: "La sessione è terminata. Accedi di nuovo.",
  backHome: "Torna alla pagina iniziale",
  codeRequested: "Codice di verifica richiesto.",
  confirmPassword: "Conferma password",
  feedbackCodeHelp:
    "Inserisci il codice ricevuto su questo numero. L’invio deve essere configurato dal gestore dell’applicazione.",
  feedbackErrorText:
    "Le tue informazioni non sono state inviate. Prova a ricaricare la pagina.",
  feedbackErrorTitle: "Non è stato possibile caricare questa pagina.",
  feedbackNotFoundText:
    "Non abbiamo trovato questa pagina. Torniamo al punto di partenza.",
  feedbackNotFoundTitle: "Una piccola deviazione.",
  feedbackResendIn: "Invia di nuovo tra {seconds} s",
  firstName: "Nome",
  forgotPassword: "Hai dimenticato la password?",
  globalErrorHeading: "Il sito è temporaneamente non disponibile",
  globalErrorText: "Riprova oppure contatta l’amministratore del sito.",
  globalErrorTitle: "Kernel — Sito non disponibile",
  home: "Pagina iniziale",
  homeBoundaryText:
    "Il sito, l’interfaccia di amministrazione e l’API hanno ciascuno le proprie responsabilità. I contratti tipizzati rendono esplicita la comunicazione tra loro.",
  homeBoundaryTitle: "Confini chiari. Meno incertezze.",
  homeCtaLabel: "Il tuo prossimo passo",
  homeCtaText:
    "Crea un account per esplorare le funzionalità integrate dell’account oppure accedi per continuare.",
  homeCtaTitle: "Fai un po’ di\nspazio a ciò che verrà.",
  homeDetailFour: "Un’API e un’applicazione di amministrazione indipendenti",
  homeDetailLabel: "Falla tua",
  homeDetailOne: "Schermate e moduli organizzati per funzionalità",
  homeDetailText:
    "Kernel offre la struttura. Il dominio, i contenuti e l’esperienza spettano a te. Parti in piccolo e sviluppa ogni funzionalità intorno a un’esigenza reale.",
  homeDetailThree: "Sessioni e verifica degli account gestite dal server",
  homeDetailTitle: "Una base,\nnon un prodotto finito.",
  homeDetailTwo:
    "Una lingua scelta dall’amministratore, con cataloghi di traduzione completi",
  homeExplore: "Esplora le fondamenta",
  homeEyebrow: "Le fondamenta di un’applicazione",
  homeIdentityText:
    "Accedi, gestisci il tuo profilo e mantieni aggiornati i dati dell’account. Le sessioni sono gestite dall’API, con cookie nel browser.",
  homeIdentityTitle: "L’identità, gestita con cura.",
  homeInterfaceText:
    "Layout adattabili, controlli accessibili, un’unica lingua per tutta l’applicazione e un tema chiaro o scuro che ricorda la tua scelta. Progettata per adattarsi.",
  homeInterfaceTitle: "Un’interfaccia che lascia spazio al tuo lavoro.",
  homeIntro:
    "Kernel riunisce account, un’API tipizzata e un’interfaccia curata. Un punto di partenza pratico, con spazio per le tue idee.",
  homeNote:
    "Applicazioni indipendenti. Un contratto condiviso. La tua direzione.",
  homeSectionLabel: "Le fondamenta",
  homeSectionText:
    "Assegna a ogni parte dell’applicazione una responsabilità chiara. Mantieni le decisioni importanti vicine al prodotto che stai creando.",
  homeSectionTitle: "L’essenziale,\ngià collegato.",
  homeTitle: "Inizia con chiarezza.",
  homeTitleAccent: "Costruisci ciò che verrà.",
  lastName: "Cognome",
  login: "Accedi",
  metadataDescription:
    "Una base per applicazioni con un sito, un’interfaccia di amministrazione e un’API indipendenti, realizzata con responsabilità ben definite.",
  metadataTitle: "Kernel — Un punto di partenza chiaro",
  mobile: "Numero di cellulare",
  mobileInvalid:
    "Inserisci un numero di cellulare di 11 cifre che inizi con 09.",
  networkError: "Non è stato possibile completare la richiesta. Riprova.",
  newPassword: "Nuova password",
  otp: "Codice di verifica",
  password: "Password",
  passwordHelp: "Usa da 8 a 128 caratteri.",
  passwordMismatch: "Le password non corrispondono.",
  pending: "Attendi…",
  register: "Crea account",
  reload: "Ricarica",
  retry: "Riprova",
  sendCode: "Invia codice",
  siteBuilt: "Costruito con responsabilità ben definite.",
  siteFooter: "Un punto di partenza per la tua prossima applicazione.",
  siteFoundation: "Le fondamenta",
  siteSkip: "Vai al contenuto",
  siteTheme: "Cambia il tema dei colori",
  unexpectedError: "Si è verificato un errore imprevisto.",
} satisfies WebsiteTranslationResource;

export default messages;
