export type EngineError  = {
    type: 'BLockNotFound' | 'DuplicateBlocks',
    meta:unknown,
    message:string
}