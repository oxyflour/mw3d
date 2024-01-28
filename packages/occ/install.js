const download = require('download'),
    os = require('os')

download(os.platform() === 'win32' ?
        'https://prebuilt.oss-cn-shanghai.aliyuncs.com/occt-7.7.zip' :
        'https://prebuilt.oss-cn-shanghai.aliyuncs.com/occt-7.4.tar.gz',
    'deps', {
        extract: true,
    })
    .then(() => {
        process.exit(0)
    })
    .catch(err => {
        console.error(err)
        process.exit(-1)
    })
