export function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    if (!String(file.type || '').startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen válido.'));
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      reject(new Error('El logo debe pesar 4 MB o menos.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No fue posible leer el logo seleccionado.'));
    reader.readAsDataURL(file);
  });
}
