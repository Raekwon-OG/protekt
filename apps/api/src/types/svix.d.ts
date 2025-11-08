declare module '@svix/svix' {
  export class Webhook {
    constructor(secret: string);
    verify(payload: string | Buffer, header: string): void;
  }
}

export {};