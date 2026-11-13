// VAPID Web Push Keys for Apple Push Notification Service (iOS 16.4+) and Google Web Push
export const VAPID_PUBLIC_KEY = 
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 
  "BIQ8Wx6YpUQLk6v8nv81zZKPZEEUQPtTS-rGIKxqlUDLwfx6wNO6t0lUMGUwj4i8ZUy_iidbqJl-teMPPwPt-90";

export const VAPID_PRIVATE_KEY = 
  process.env.VAPID_PRIVATE_KEY || 
  "iunSblDbBc6grW-WirJRJq5Nm4_mnRJudSlOy_GLeLE";

export const VAPID_SUBJECT = 
  process.env.VAPID_SUBJECT || 
  "mailto:sahindzemsit@gmail.com";
