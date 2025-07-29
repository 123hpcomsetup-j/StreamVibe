import NodeMediaServer from 'node-media-server';

export function startMediaServer() {
  const config = {
    rtmp: {
      port: 1935,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60
    },
    http: {
      port: 8000,
      allow_origin: '*',
      mediaroot: './media'
    },
    trans: {
      ffmpeg: '/usr/bin/ffmpeg',
      tasks: [
        {
          app: 'live',
          hls: true,
          hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
          dash: true,
          dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
        }
      ]
    }
  };

  const nms = new NodeMediaServer(config);
  
  nms.on('preConnect', (id, args) => {
    console.log('[NodeMediaServer] preConnect', id, args);
  });

  nms.on('postConnect', (id, args) => {
    console.log('[NodeMediaServer] postConnect', id, args);
  });

  nms.on('doneConnect', (id, args) => {
    console.log('[NodeMediaServer] doneConnect', id, args);
  });

  nms.on('prePublish', (id, StreamPath, args) => {
    console.log('[NodeMediaServer] prePublish', id, StreamPath, args);
    // You can add authentication here
  });

  nms.on('postPublish', (id, StreamPath, args) => {
    console.log('[NodeMediaServer] postPublish', id, StreamPath, args);
  });

  nms.on('donePublish', (id, StreamPath, args) => {
    console.log('[NodeMediaServer] donePublish', id, StreamPath, args);
  });

  nms.on('prePlay', (id, StreamPath, args) => {
    console.log('[NodeMediaServer] prePlay', id, StreamPath, args);
  });

  nms.on('postPlay', (id, StreamPath, args) => {
    console.log('[NodeMediaServer] postPlay', id, StreamPath, args);
  });

  nms.on('donePlay', (id, StreamPath, args) => {
    console.log('[NodeMediaServer] donePlay', id, StreamPath, args);
  });

  nms.run();
  console.log('Node Media Server started on ports 1935 (RTMP) and 8000 (HTTP)');
  
  return nms;
}