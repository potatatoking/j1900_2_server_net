function cropImage(source, squareOnly = false) {
  return new Promise((resolve, reject) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'image-crop-dialog';
    dialog.setAttribute('aria-labelledby', 'crop-title');
    dialog.innerHTML = `<h2 id="crop-title">裁剪图片</h2><div class="crop-stage"><img alt="待裁剪图片"></div><div class="crop-tools"><label>比例<select aria-label="裁剪比例"><option value="1">正方形</option>${squareOnly ? '' : '<option value="1.3333333333">横向 4:3</option><option value="0.75">纵向 3:4</option><option value="NaN">自由比例</option>'}</select></label><button type="button" data-tool="in" title="放大" aria-label="放大">+</button><button type="button" data-tool="out" title="缩小" aria-label="缩小">−</button><button type="button" data-tool="rotate" title="旋转 90 度" aria-label="旋转 90 度">↻</button><button type="button" data-tool="reset" title="重置" aria-label="重置">↺</button></div><p class="form-error" role="alert"></p><div class="crop-actions"><button type="button" data-result="cancel">取消</button><button type="button" data-result="original">使用原图</button><button type="button" class="btn" data-result="crop" disabled>完成裁剪</button></div>`;
    document.body.append(dialog);
    const image = dialog.querySelector('img');
    const confirm = dialog.querySelector('[data-result="crop"]');
    const tools = dialog.querySelectorAll('.crop-tools button, .crop-tools select');
    tools.forEach(tool => { tool.disabled = true; });
    let cropper;
    let finished = false;
    function finish(value, error) {
      if (finished) return;
      finished = true;
      window.removeEventListener('hashchange', cancel);
      cropper?.destroy();
      dialog.close();
      dialog.remove();
      if (error) reject(error); else resolve(value);
    }
    const cancel = () => finish(null);
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    window.addEventListener('hashchange', cancel);
    dialog.addEventListener('change', event => {
      if (event.target.matches('select')) cropper?.setAspectRatio(Number(event.target.value));
    });
    dialog.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      const action = button.dataset.result;
      if (action === 'cancel') return cancel();
      if (action === 'original') return finish(source);
      if (action === 'crop') {
        try {
          const canvas = cropper.getCroppedCanvas({ maxWidth: 1600, maxHeight: 1600, imageSmoothingQuality: 'high' });
          if (!canvas?.width || !canvas.height) throw new Error('请选择有效的裁剪区域');
          const result = canvas.toDataURL('image/webp', 0.9);
          if (result.length * 0.75 > 2_000_000) throw new Error('裁剪后的图片超过 2 MB，请缩小选区');
          finish(result);
        } catch (error) { dialog.querySelector('.form-error').textContent = error.message; }
        return;
      }
      if (button.dataset.tool === 'in') cropper.zoom(0.1);
      if (button.dataset.tool === 'out') cropper.zoom(-0.1);
      if (button.dataset.tool === 'rotate') cropper.rotate(90);
      if (button.dataset.tool === 'reset') {
        cropper.reset();
        cropper.setAspectRatio(Number(dialog.querySelector('select').value));
      }
    });
    image.onload = () => {
      if (finished) return;
      try {
        cropper = new Cropper(image, {
          aspectRatio: 1, viewMode: 1, autoCropArea: 1, background: false,
          ready() { confirm.disabled = false; tools.forEach(tool => { tool.disabled = false; }); }
        });
      } catch (error) { finish(null, error); }
    };
    image.onerror = () => finish(null, new Error('图片读取失败，请重新选择'));
    dialog.showModal();
    image.src = source;
  });
}
