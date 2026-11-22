export function imageFormat(buffer: Buffer) {
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return 'jpeg';
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'png';
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return undefined;
}
