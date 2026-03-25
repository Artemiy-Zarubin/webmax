declare module 'lz4/lib/binding.js' {
  export function uncompress(input: Buffer, output: Buffer): number;
}
