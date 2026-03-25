declare module 'qrcode-terminal' {
  const qrcode: {
    generate(text: string, options?: { small?: boolean }, callback?: (qr: string) => void): void;
  };
  export = qrcode;
}
