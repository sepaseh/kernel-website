import type { WebsiteTranslationResource } from "../website-types.ts";

const messages = {
  account: "Conta",
  accountChangePassword: "Alterar palavra-passe",
  accountCheckAgain: "Verificar novamente",
  accountCurrentPassword: "Palavra-passe atual",
  accountEmail: "Verificação de e-mail",
  accountEmailLabel: "E-mail",
  accountEmailText:
    "Adicione um endereço de e-mail e verifique-o com um código.",
  accountEmailVerified: "O seu endereço de e-mail foi verificado.",
  accountEyebrow: "O seu espaço",
  accountIntro: "Alguns detalhes para tornar esta conta sua.",
  accountLogout: "Terminar sessão",
  accountMobileHelp:
    "O seu número de telemóvel é a sua identificação para iniciar sessão.",
  accountPasswordText:
    "Utilize uma palavra-passe que não use noutros serviços.",
  accountProfile: "Perfil",
  accountProfileText: "Mantenha o seu nome atualizado.",
  accountProfileUpdated: "Perfil atualizado com sucesso.",
  accountSaveProfile: "Guardar perfil",
  accountSaveUsername: "Guardar nome de utilizador",
  accountSessionError: "Não foi possível carregar a sua conta.",
  accountSessionLoading: "A verificar a sua sessão…",
  accountTitle: "Olá, {name}.",
  accountUsername: "Nome de utilizador",
  accountUsernameHelp:
    "3–30 letras minúsculas, números, pontos, hífenes ou sublinhados.",
  accountUsernameText:
    "Escolha um nome de utilizador reconhecível para a sua conta.",
  accountUsernameUpdated: "Nome de utilizador atualizado com sucesso.",
  accountVerifiedEmail: "E-mail verificado: {email}",
  accountVerifyEmail: "Verificar e-mail",
  authAccountSideLabel: "Um ponto de partida claro",
  authAccountSideText:
    "O seu perfil, as suas preferências e o próximo passo — tudo no mesmo lugar.",
  authAccountSideTitle: "Um pouco de estrutura.\nMuitas possibilidades.",
  authBackToLogin: "Voltar ao início de sessão",
  authHasAccount: "Já tem uma conta?",
  authLoginText: "Inicie sessão para continuar na sua conta.",
  authLoginTitle: "É bom vê-lo.",
  authLogoutSuccess: "Terminou a sessão.",
  authNoAccount: "É a primeira vez no Kernel?",
  authPasswordChanged: "Palavra-passe alterada com sucesso.",
  authPasswordReset:
    "A palavra-passe foi reposta. Inicie sessão com a nova palavra-passe.",
  authRecoveryText:
    "Peça um código de verificação e escolha uma nova palavra-passe.",
  authRecoveryTitle: "Vamos recuperar o seu acesso.",
  authRegisterText:
    "Crie a sua conta com um código de verificação para o telemóvel.",
  authRegisterTitle: "Um novo começo.",
  authResetPassword: "Repor palavra-passe",
  authSessionExpired: "A sua sessão terminou. Inicie sessão novamente.",
  backHome: "Voltar à página inicial",
  codeRequested: "Código de verificação solicitado.",
  confirmPassword: "Confirmar palavra-passe",
  feedbackCodeHelp:
    "Introduza o código enviado para este número. A entrega deve ser configurada pelo operador da aplicação.",
  feedbackErrorText:
    "Os seus dados não foram enviados. Tente carregar a página novamente.",
  feedbackErrorTitle: "Não foi possível carregar esta página.",
  feedbackNotFoundText: "Não encontrámos essa página. Vamos voltar ao início.",
  feedbackNotFoundTitle: "Um pequeno desvio.",
  feedbackResendIn: "Reenviar em {seconds}s",
  firstName: "Nome próprio",
  forgotPassword: "Esqueceu-se da palavra-passe?",
  globalErrorHeading: "O site está temporariamente indisponível",
  globalErrorText: "Tente novamente ou contacte o administrador do site.",
  globalErrorTitle: "Kernel — Site indisponível",
  home: "Página inicial",
  homeBoundaryText:
    "O site, o painel de gestão e a API têm responsabilidades próprias. Os contratos tipados tornam explícita a comunicação entre eles.",
  homeBoundaryTitle: "Limites claros. Menos suposições.",
  homeCtaLabel: "O próximo passo",
  homeCtaText:
    "Crie uma conta para explorar a experiência de gestão de conta integrada ou inicie sessão para continuar.",
  homeCtaTitle: "Abra um pouco de espaço\npara o que vem a seguir.",
  homeDetailFour: "Uma API e um painel de gestão independentes",
  homeDetailLabel: "Dê-lhe o seu toque",
  homeDetailOne: "Ecrãs e formulários organizados por funcionalidade",
  homeDetailText:
    "O Kernel fornece a estrutura. O domínio, o conteúdo e a experiência da sua aplicação são seus. Comece pelo essencial e desenvolva cada funcionalidade em torno de uma necessidade real.",
  homeDetailThree: "Sessões geridas pelo servidor e verificação de contas",
  homeDetailTitle: "Uma base,\nnão um produto acabado.",
  homeDetailTwo:
    "Um idioma definido pelo administrador, com catálogos de tradução completos",
  homeExplore: "Explore a base",
  homeEyebrow: "Uma base para aplicações",
  homeIdentityText:
    "Inicie sessão, gira o seu perfil e mantenha os dados da conta atualizados. As sessões são geridas pela API, com cookies no navegador.",
  homeIdentityTitle: "Uma gestão cuidada da identidade.",
  homeInterfaceText:
    "Disposições adaptáveis, controlos acessíveis, um idioma para toda a aplicação e um tema claro ou escuro persistente. Tudo pensado para ser adaptado.",
  homeInterfaceTitle: "Uma interface que não atrapalha.",
  homeIntro:
    "O Kernel reúne contas, uma API tipada e uma interface cuidada. Um início prático, com espaço para as suas ideias.",
  homeNote: "Aplicações independentes. Um contrato partilhado. A sua direção.",
  homeSectionLabel: "A base",
  homeSectionText:
    "Dê a cada parte da aplicação uma responsabilidade clara. Tome as decisões importantes tendo em conta o produto que está a construir.",
  homeSectionTitle: "O essencial,\njá interligado.",
  homeTitle: "Comece com clareza.",
  homeTitleAccent: "Construa o que vem a seguir.",
  lastName: "Apelido",
  login: "Iniciar sessão",
  metadataDescription:
    "Uma base para aplicações com site, painel de gestão e API independentes, com responsabilidades bem definidas.",
  metadataTitle: "Kernel — Um ponto de partida claro",
  mobile: "Número de telemóvel",
  mobileInvalid:
    "Introduza um número de telemóvel de 11 algarismos começado por 09.",
  networkError: "Não foi possível concluir o pedido. Tente novamente.",
  newPassword: "Nova palavra-passe",
  otp: "Código de verificação",
  password: "Palavra-passe",
  passwordHelp: "Utilize entre 8 e 128 caracteres.",
  passwordMismatch: "As palavras-passe não coincidem.",
  pending: "Aguarde…",
  register: "Criar conta",
  reload: "Recarregar",
  retry: "Tentar novamente",
  sendCode: "Enviar código",
  siteBuilt: "Criado com limites bem definidos.",
  siteFooter: "Um ponto de partida para a sua próxima aplicação.",
  siteFoundation: "A base",
  siteSkip: "Saltar para o conteúdo",
  siteTheme: "Alternar tema de cores",
  unexpectedError: "Ocorreu um erro inesperado.",
} satisfies WebsiteTranslationResource;

export default messages;
