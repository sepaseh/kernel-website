import type { WebsiteTranslationResource } from "../website-types.ts";

const messages = {
  account: "Compte",
  accountChangePassword: "Modifier le mot de passe",
  accountCheckAgain: "Vérifier à nouveau",
  accountCurrentPassword: "Mot de passe actuel",
  accountEmail: "Vérification de l’adresse e-mail",
  accountEmailLabel: "Adresse e-mail",
  accountEmailText:
    "Ajoutez une adresse e-mail et vérifiez-la à l’aide d’un code.",
  accountEmailVerified: "Votre adresse e-mail a été vérifiée.",
  accountEyebrow: "Votre espace",
  accountIntro: "Quelques détails pour un compte qui vous ressemble.",
  accountLogout: "Se déconnecter",
  accountMobileHelp:
    "Votre numéro de téléphone mobile est votre identifiant de connexion.",
  accountPasswordText:
    "Utilisez un mot de passe que vous n’employez pas ailleurs.",
  accountProfile: "Profil",
  accountProfileText: "Tenez votre nom à jour.",
  accountProfileUpdated: "Le profil a été mis à jour.",
  accountSaveProfile: "Enregistrer le profil",
  accountSaveUsername: "Enregistrer le nom d’utilisateur",
  accountSessionError: "Votre compte n’a pas pu être chargé.",
  accountSessionLoading: "Vérification de votre session…",
  accountTitle: "Bonjour, {name}.",
  accountUsername: "Nom d’utilisateur",
  accountUsernameHelp:
    "De 3 à 30 lettres minuscules, chiffres, points, tirets ou tirets bas.",
  accountUsernameText:
    "Choisissez un nom d’utilisateur reconnaissable pour votre compte.",
  accountUsernameUpdated: "Le nom d’utilisateur a été mis à jour.",
  accountVerifiedEmail: "Adresse e-mail vérifiée : {email}",
  accountVerifyEmail: "Vérifier l’adresse e-mail",
  authAccountSideLabel: "Un point de départ clair",
  authAccountSideText:
    "Votre profil, vos préférences et votre prochaine étape, au même endroit.",
  authAccountSideTitle: "Un peu de structure.\nBeaucoup de possibilités.",
  authBackToLogin: "Retour à la connexion",
  authHasAccount: "Vous avez déjà un compte ?",
  authLoginText: "Connectez-vous pour accéder à votre compte.",
  authLoginTitle: "Ravi de vous retrouver.",
  authLogoutSuccess: "Vous avez été déconnecté.",
  authNoAccount: "Vous découvrez Kernel ?",
  authPasswordChanged: "Le mot de passe a été modifié.",
  authPasswordReset:
    "Votre mot de passe a été réinitialisé. Connectez-vous avec votre nouveau mot de passe.",
  authRecoveryText:
    "Demandez un code de vérification, puis choisissez un nouveau mot de passe.",
  authRecoveryTitle: "Retrouvons votre accès.",
  authRegisterText:
    "Créez votre compte à l’aide d’un code de vérification mobile.",
  authRegisterTitle: "Un nouveau départ.",
  authResetPassword: "Réinitialiser le mot de passe",
  authSessionExpired: "Votre session a pris fin. Veuillez vous reconnecter.",
  backHome: "Retour à l’accueil",
  codeRequested: "Un code de vérification a été demandé.",
  confirmPassword: "Confirmer le mot de passe",
  feedbackCodeHelp:
    "Saisissez le code envoyé à ce numéro. L’envoi doit être configuré par le responsable de l’application.",
  feedbackErrorText:
    "Vos informations n’ont pas été envoyées. Essayez de recharger la page.",
  feedbackErrorTitle: "Cette page n’a pas pu être chargée.",
  feedbackNotFoundText:
    "Cette page est introuvable. Revenons au point de départ.",
  feedbackNotFoundTitle: "Un petit écart de parcours.",
  feedbackResendIn: "Renvoyer dans {seconds} s",
  firstName: "Prénom",
  forgotPassword: "Mot de passe oublié ?",
  globalErrorHeading: "Le site est temporairement indisponible",
  globalErrorText: "Veuillez réessayer ou contacter l’administrateur du site.",
  globalErrorTitle: "Kernel — Site indisponible",
  home: "Accueil",
  homeBoundaryText:
    "Le site, l’interface d’administration et l’API ont chacun leurs responsabilités. Les contrats typés rendent leurs échanges explicites.",
  homeBoundaryTitle: "Des responsabilités claires. Moins d’incertitude.",
  homeCtaLabel: "Votre prochaine étape",
  homeCtaText:
    "Créez un compte pour découvrir les fonctionnalités de compte intégrées, ou connectez-vous pour continuer.",
  homeCtaTitle: "Faites un peu de\nplace à la suite.",
  homeDetailFour: "Une API et une application d’administration indépendantes",
  homeDetailLabel: "À votre image",
  homeDetailOne: "Des écrans et formulaires propres à chaque fonctionnalité",
  homeDetailText:
    "Kernel fournit la structure. Le domaine, le contenu et l’expérience vous appartiennent. Commencez modestement et concevez chaque fonctionnalité autour d’un besoin réel.",
  homeDetailThree:
    "Des sessions et une vérification des comptes gérées par le serveur",
  homeDetailTitle: "Des fondations,\npas un produit fini.",
  homeDetailTwo:
    "Une langue choisie par votre administrateur, avec des catalogues de traduction complets",
  homeExplore: "Découvrez les fondations",
  homeEyebrow: "Les fondations d’une application",
  homeIdentityText:
    "Connectez-vous, gérez votre profil et tenez les informations de votre compte à jour. Les sessions sont gérées par l’API, avec des cookies dans le navigateur.",
  homeIdentityTitle: "L’identité, gérée avec soin.",
  homeInterfaceText:
    "Des mises en page adaptatives, des commandes accessibles, une langue commune à toute l’application et un thème clair ou sombre qui conserve votre choix. Une interface conçue pour s’adapter.",
  homeInterfaceTitle: "Une interface qui vous laisse avancer.",
  homeIntro:
    "Kernel réunit des comptes utilisateurs, une API typée et une interface soignée. Un point de départ pratique, avec de la place pour vos idées.",
  homeNote:
    "Des applications indépendantes. Un contrat partagé. Votre direction.",
  homeSectionLabel: "Les fondations",
  homeSectionText:
    "Donnez à chaque partie de votre application une responsabilité claire. Gardez les décisions importantes au plus près du produit que vous créez.",
  homeSectionTitle: "L’essentiel,\ndéjà connecté.",
  homeTitle: "Partez sur des bases claires.",
  homeTitleAccent: "Construisez la suite.",
  lastName: "Nom de famille",
  login: "Se connecter",
  metadataDescription:
    "Une base d’application avec un site, une interface d’administration et une API indépendants, conçue autour de responsabilités claires.",
  metadataTitle: "Kernel — Un point de départ clair",
  mobile: "Numéro de téléphone mobile",
  mobileInvalid:
    "Saisissez un numéro de téléphone mobile à 11 chiffres commençant par 09.",
  networkError: "La demande n’a pas pu aboutir. Veuillez réessayer.",
  newPassword: "Nouveau mot de passe",
  otp: "Code de vérification",
  password: "Mot de passe",
  passwordHelp: "Utilisez entre 8 et 128 caractères.",
  passwordMismatch: "Les mots de passe ne correspondent pas.",
  pending: "Veuillez patienter…",
  register: "Créer un compte",
  reload: "Recharger",
  retry: "Réessayer",
  sendCode: "Envoyer le code",
  siteBuilt: "Conçu avec des responsabilités claires.",
  siteFooter: "Un point de départ pour votre prochaine application.",
  siteFoundation: "Les fondations",
  siteSkip: "Aller au contenu",
  siteTheme: "Changer le thème de couleurs",
  unexpectedError: "Une erreur inattendue s’est produite.",
} satisfies WebsiteTranslationResource;

export default messages;
