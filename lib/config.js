const correlationIdHeader = 'x-correlation-id'

const headersToCollect = [
    'x-request-id',
    'x-b3-traceid',
    'x-b3-spanid',
    'x-b3-parentspanid',
    'x-b3-sampled',
    'x-b3-flags',
    'x-ot-span-context',
    'x-variant-id'
]

const headersToInject = ['x-correlation-id'].concat(headersToCollect)

module.exports = {
    correlationIdHeader,
    headersToCollect,
    headersToInject
}