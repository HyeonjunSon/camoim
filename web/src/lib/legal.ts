/**
 * Re-exported straight from the app's constants so the web can never drift
 * from the text a user agreed to on their phone. The file is plain ESM string
 * exports with no React Native imports, so it travels unchanged.
 */
export {
  TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  PRIVACY_VERSION,
  PRIVACY_EFFECTIVE_DATE,
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
} from '../../../src/constants/legal';
