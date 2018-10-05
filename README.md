Inspiration from this [talk](https://youtu.be/A2CqsR_1wyc?t=5h26m40s) ([Slides and Code](https://github.com/watson/talks/tree/master/2016/06%20NodeConf%20Oslo)) and this [module](https://github.com/guyguyon/node-request-context)


The first goal is to be able to propagate certain headers (i.e. X-Correlation-ID) to outbound HTTP requests without the need to do it programmatically in the service.

It works by using a global `tracer` object which keeps a records of traces (a `trace` object per http request). The header value is saved in the `trace` object associated with the current request. 
The http core code is wrapped to record headers on the `trace` (on the request listener of the http server set with `http.createServer`) and inject headers to the outbound requests (currently only on `http.request`).

Node's `async_hooks` module (new in Node 8) is used to set/reset `tracer.currentTrace` to the trace relevant to the current execution context. `tracer.currentTrace` is used in the wrapped functions to record/access the headers data.

Add `require('ww-agent')` ideally as the first statement of your code to use.

Limitations
- Only transfers `X-Correlation-ID`
- (Probably) Only works with Express apps currently
- Only propagate headers if `http.request(options)` is used with `options` as an `Object`.
- Need Node >= 8
- Many more....