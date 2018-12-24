export function isEventEmitter(obj: any): boolean {
  return obj && typeof obj.on === 'function' && typeof obj.off === 'function'
}
