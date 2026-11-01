import type { WebsiteTranslationResource } from "../website-types.ts";

const messages = {
  account: "Cuenta",
  accountChangePassword: "Cambiar contraseña",
  accountCheckAgain: "Comprobar de nuevo",
  accountCurrentPassword: "Contraseña actual",
  accountEmail: "Verificación del correo electrónico",
  accountEmailLabel: "Correo electrónico",
  accountEmailText:
    "Añade una dirección de correo electrónico y verifícala con un código.",
  accountEmailVerified: "Tu dirección de correo electrónico se ha verificado.",
  accountEyebrow: "Tu espacio",
  accountIntro: "Unos detalles que hacen que esta cuenta sea tuya.",
  accountLogout: "Cerrar sesión",
  accountMobileHelp:
    "Tu número de móvil es tu identificador para iniciar sesión.",
  accountPasswordText: "Usa una contraseña que no utilices en otros sitios.",
  accountProfile: "Perfil",
  accountProfileText: "Mantén tu nombre actualizado.",
  accountProfileUpdated: "El perfil se ha actualizado correctamente.",
  accountSaveProfile: "Guardar perfil",
  accountSaveUsername: "Guardar nombre de usuario",
  accountSessionError: "No se ha podido cargar tu cuenta.",
  accountSessionLoading: "Comprobando tu sesión…",
  accountTitle: "Hola, {name}.",
  accountUsername: "Nombre de usuario",
  accountUsernameHelp:
    "Entre 3 y 30 letras minúsculas, números, puntos, guiones o guiones bajos.",
  accountUsernameText: "Elige un nombre de usuario reconocible para tu cuenta.",
  accountUsernameUpdated:
    "El nombre de usuario se ha actualizado correctamente.",
  accountVerifiedEmail: "Correo electrónico verificado: {email}",
  accountVerifyEmail: "Verificar correo electrónico",
  authAccountSideLabel: "Un punto de partida claro",
  authAccountSideText:
    "Tu perfil, tus preferencias y tu próximo paso, todo en un mismo lugar.",
  authAccountSideTitle: "Un poco de estructura.\nMuchas posibilidades.",
  authBackToLogin: "Volver a iniciar sesión",
  authHasAccount: "¿Ya tienes una cuenta?",
  authLoginText: "Inicia sesión para continuar en tu cuenta.",
  authLoginTitle: "Qué gusto verte.",
  authLogoutSuccess: "Has cerrado la sesión.",
  authNoAccount: "¿Acabas de llegar a Kernel?",
  authPasswordChanged: "La contraseña se ha cambiado correctamente.",
  authPasswordReset:
    "Tu contraseña se ha restablecido. Inicia sesión con tu nueva contraseña.",
  authRecoveryText:
    "Solicita un código de verificación y elige una nueva contraseña.",
  authRecoveryTitle: "Recupera el acceso.",
  authRegisterText: "Crea tu cuenta con un código de verificación del móvil.",
  authRegisterTitle: "Un nuevo comienzo.",
  authResetPassword: "Restablecer contraseña",
  authSessionExpired: "Tu sesión ha finalizado. Inicia sesión de nuevo.",
  backHome: "Volver al inicio",
  codeRequested: "Se ha solicitado un código de verificación.",
  confirmPassword: "Confirmar contraseña",
  feedbackCodeHelp:
    "Introduce el código enviado a este número. El responsable de la aplicación debe configurar el envío.",
  feedbackErrorText:
    "Tu información no se ha enviado. Intenta cargar la página de nuevo.",
  feedbackErrorTitle: "No se ha podido cargar esta página.",
  feedbackNotFoundText:
    "No hemos encontrado esa página. Volvamos al principio.",
  feedbackNotFoundTitle: "Nos hemos desviado un poco.",
  feedbackResendIn: "Reenviar en {seconds} s",
  firstName: "Nombre",
  forgotPassword: "¿Has olvidado tu contraseña?",
  globalErrorHeading: "El sitio web no está disponible temporalmente",
  globalErrorText:
    "Inténtalo de nuevo o ponte en contacto con el administrador del sitio web.",
  globalErrorTitle: "Kernel — Sitio web no disponible",
  home: "Inicio",
  homeBoundaryText:
    "El sitio web, la interfaz de administración y la API tienen responsabilidades propias. Los contratos tipados mantienen explícita la comunicación entre ellos.",
  homeBoundaryTitle: "Límites claros. Menos dudas.",
  homeCtaLabel: "Tu próximo paso",
  homeCtaText:
    "Crea una cuenta para explorar la experiencia de cuenta integrada, o inicia sesión para continuar.",
  homeCtaTitle: "Haz un poco de\nespacio para lo que viene.",
  homeDetailFour: "Una API y una aplicación de administración independientes",
  homeDetailLabel: "Hazlo tuyo",
  homeDetailOne: "Pantallas y formularios propios de cada funcionalidad",
  homeDetailText:
    "Kernel aporta la estructura. El dominio, el contenido y la experiencia del producto te corresponden a ti. Empieza poco a poco y diseña cada funcionalidad en torno a una necesidad real.",
  homeDetailThree:
    "Sesiones y verificación de cuentas gestionadas por el servidor",
  homeDetailTitle: "Una base,\nno un producto terminado.",
  homeDetailTwo:
    "Un idioma elegido por el administrador, con catálogos de traducción completos",
  homeExplore: "Explora la base",
  homeEyebrow: "Una base para aplicaciones",
  homeIdentityText:
    "Inicia sesión, gestiona tu perfil y mantén al día los datos de tu cuenta. Las sesiones las gestiona la API, con cookies en el navegador.",
  homeIdentityTitle: "La identidad, gestionada con cuidado.",
  homeInterfaceText:
    "Diseños adaptables, controles accesibles, un idioma común para toda la aplicación y un tema claro u oscuro que recuerda tu elección. Hecho para adaptarse.",
  homeInterfaceTitle: "Una interfaz que no se interpone.",
  homeIntro:
    "Kernel reúne cuentas de usuario, una API tipada y una interfaz cuidada. Un comienzo práctico, con espacio para tus propias ideas.",
  homeNote: "Aplicaciones independientes. Un contrato compartido. Tu rumbo.",
  homeSectionLabel: "La base",
  homeSectionText:
    "Asigna una responsabilidad clara a cada parte de tu aplicación. Mantén las decisiones importantes cerca del producto que estás creando.",
  homeSectionTitle: "Lo esencial,\nya conectado.",
  homeTitle: "Empieza con claridad.",
  homeTitleAccent: "Construye lo que viene.",
  lastName: "Apellidos",
  login: "Iniciar sesión",
  metadataDescription:
    "Una base para aplicaciones con un sitio web, una interfaz de administración y una API independientes, con responsabilidades bien definidas.",
  metadataTitle: "Kernel — Un punto de partida claro",
  mobile: "Número de móvil",
  mobileInvalid:
    "Introduce un número de móvil de 11 dígitos que empiece por 09.",
  networkError: "No se ha podido completar la solicitud. Inténtalo de nuevo.",
  newPassword: "Nueva contraseña",
  otp: "Código de verificación",
  password: "Contraseña",
  passwordHelp: "Usa entre 8 y 128 caracteres.",
  passwordMismatch: "Las contraseñas no coinciden.",
  pending: "Espera un momento…",
  register: "Crear cuenta",
  reload: "Recargar",
  retry: "Intentar de nuevo",
  sendCode: "Enviar código",
  siteBuilt: "Creado con responsabilidades claras.",
  siteFooter: "Un punto de partida para tu próxima aplicación.",
  siteFoundation: "La base",
  siteSkip: "Saltar al contenido",
  siteTheme: "Cambiar el tema de color",
  unexpectedError: "Se ha producido un error inesperado.",
} satisfies WebsiteTranslationResource;

export default messages;
