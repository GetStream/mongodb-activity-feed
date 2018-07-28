



function chunkify(iterable, size) {
    const chunks = []
    for (let i=0, j=iterable.length; i<j; i+=size) {
        chunks.push(iterable.slice(i,i+size))
    }
    return chunks
}


export default chunkify;
