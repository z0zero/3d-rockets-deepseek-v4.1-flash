/** Feature detection so the app can show a useful message without WebGL. */
export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    return Boolean(context);
  } catch {
    return false;
  }
}