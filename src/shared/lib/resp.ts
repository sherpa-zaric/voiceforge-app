export function respData(data: any) {
  return respJson(0, 'ok', data);
}

export function respOk() {
  return respJson(0, 'ok');
}

export function respErr(message: string) {
  return respJson(-1, message);
}

export function respJson(code: number, message: string, data?: any) {
  const json: any = {
    code,
    message,
  };

  if (data !== undefined) {
    json.data = data;
  }

  return Response.json(json);
}
