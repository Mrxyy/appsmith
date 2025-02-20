import type { Def, Server } from "tern";
import type { CallbackFn } from "./types";
import { TernWorkerAction } from "./types";

const ternWorker = new Worker(
  new URL("../../workers/Tern/tern.worker.ts", import.meta.url),
  {
    // Note: the `Worker` part of the name is slightly important – LinkRelPreload_spec.js
    // relies on it to find workers in the list of all requests.
    name: "TernWorker",
    type: "module",
  },
);

// TODO: Fix this the next time the file is edited
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFile(ts: any, name: string, c: CallbackFn) {
  const buf = ts.docs[name];

  if (buf) c(ts.docValue(ts, buf));
  else if (ts.options.getFile) ts.options.getFile(name, c);
  else c(null);
}

interface TernWorkerServerConstructor {
  // TODO: Fix this the next time the file is edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ts: any): void;
  // TODO: Fix this the next time the file is edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (ts: any): Server;
}

// TODO: Fix this the next time the file is edited
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TernWorkerServer(this: any, ts: any) {
  const worker = (ts.worker = ternWorker);

  worker.postMessage({
    type: TernWorkerAction.INIT,
    plugins: ts.options.plugins,
    scripts: ts.options.workerDeps,
  });
  let msgId = 0;
  let pending: { [x: number]: CallbackFn } = {};

  // TODO: Fix this the next time the file is edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function send(data: any, c?: CallbackFn) {
    if (c) {
      data.id = ++msgId;
      pending[msgId] = c;
    }

    worker.postMessage(data);
  }

  worker.onmessage = function (e) {
    const data = e.data;

    if (data) {
      if (data.type == TernWorkerAction.GET_FILE) {
        getFile(ts, data.name, function (err, text) {
          send({
            type: TernWorkerAction.GET_FILE,
            err: String(err),
            text: text,
            id: data.id,
          });
        });
      } else if (data.type == TernWorkerAction.DEBUG) {
        window.console.log(data.message);
      } else if (data.id && pending[data.id]) {
        pending[data.id](data.err, data.body);
        delete pending[data.id];
      }
    }
  };
  worker.onerror = function (e) {
    for (const id in pending) pending[id](e);

    pending = {};
  };

  this.addFile = function (name: string, text: string) {
    send({ type: TernWorkerAction.ADD_FILE, name: name, text: text });
  };
  this.delFile = function (name: string) {
    send({ type: TernWorkerAction.DELETE_FILE, name: name });
  };
  // TODO: Fix this the next time the file is edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  this.request = function (body: any, c: CallbackFn) {
    send({ type: TernWorkerAction.REQUEST, body: body }, c);
  };
  this.addDefs = function (defs: Def) {
    send({ type: TernWorkerAction.ADD_DEF, defs });
  };
  this.deleteDefs = function (name: string) {
    send({ type: TernWorkerAction.DELETE_DEF, name });
  };
}

export default TernWorkerServer as TernWorkerServerConstructor;
