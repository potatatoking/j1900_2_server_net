/* Structured document editor and durable drafts; no third-party runtime. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tags = new Set(['p','h2','h3','blockquote','ul','ol','li','strong','em','u','a','br','img']);
  const files = new Map();
  let active = null;
  const local = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ } }
  };
  function forgetDraft(id, postId) {
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith('blog-writing:post:')) continue;
        if (local.get(key)?.draftId === id || key === `blog-writing:post:${id}` || (postId && key === `blog-writing:post:${postId}`)) local.remove(key);
      }
    } catch { /* Storage may be disabled. */ }
  }
  function url(value) { try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
  function renderNodes(nodes = []) {
    return nodes.map(n => {
      if (n.type === 'text') return escape(n.text);
      if (!tags.has(n.type)) return '';
      if (n.type === 'br') return '<br>';
      if (n.type === 'img') return /^\/assets\/uploads\/[\w-]+\.(png|jpg|webp)$/.test(n.src || '') ? `<img src="${escape(n.src)}" alt="${escape(n.alt)}" loading="lazy">` : '';
      const inner = renderNodes(n.children || []);
      if (n.type === 'a') return url(n.href) ? `<a href="${escape(url(n.href))}" target="_blank" rel="noopener noreferrer nofollow ugc">${inner}</a>` : inner;
      return `<${n.type}>${inner}</${n.type}>`;
    }).join('');
  }
  function render(post) {
    const text = post.document ? renderNodes(post.document) : escape(post.content).replace(/\n/g, '<br>');
    return `<div class="document-body">${text}</div>${post.sourceUrl && url(post.sourceUrl) ? `<p class="document-source"><a href="${escape(url(post.sourceUrl))}" target="_blank" rel="noopener noreferrer nofollow ugc">关联链接 ↗</a></p>` : ''}${post.attachments?.length ? `<ul class="document-attachments">${post.attachments.map((id,i) => /^[\w-]+$/.test(id) ? `<li><a href="/api/documents/${escape(id)}" target="_blank" rel="noopener">📎 ${escape(files.get(id)?.name || `文档 ${i+1}`)} · 下载</a></li>` : '').join('')}</ul>` : ''}`;
  }
  function serialize(parent) {
    return [...parent.childNodes].flatMap(n => {
      if (n.nodeType === 3) return n.textContent ? [{type:'text',text:n.textContent}] : [];
      if (n.nodeType !== 1 || ['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH'].includes(n.tagName)) return [];
      let type = n.tagName.toLowerCase();
      type = ({div:'p',b:'strong',i:'em'})[type] || type;
      if (type === 'img') return /^\/assets\/uploads\/[\w-]+\.(png|jpg|webp)$/.test(n.getAttribute('src') || '') ? [{type,src:n.getAttribute('src'),alt:n.alt || ''}] : [];
      if (type === 'br') return [{type}];
      const children = serialize(n);
      if (type === 'a') return url(n.getAttribute('href')) ? [{type,href:url(n.getAttribute('href')),children}] : children;
      return tags.has(type) ? [{type,children}] : children;
    });
  }
  async function api(route, method = 'GET', data) {
    const r = await fetch(route, {method, headers: data ? {'Content-Type':'application/json'} : {}, body:data ? JSON.stringify(data) : undefined});
    const value = await r.json();
    if (!r.ok) throw new Error(value.error || '保存失败，请稍后再试');
    return value;
  }
  function dataUrl(file) { return new Promise((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('文件读取失败')); r.readAsDataURL(file); }); }
  function enhance(form, initial = {}, key, onChange = () => {}) {
    const textarea = form.querySelector('textarea[name="content"]');
    if (!textarea || form._writing) return form._writing;
    const saved = local.get(key);
    if (saved) {
      for (const [name,value] of Object.entries(saved.fields || {})) { const field = form.elements.namedItem(name); if (field && typeof value === 'string') field.value = value; }
      initial = {...initial,...saved};
    }
    const container = document.createElement('section'); container.className = 'writing-editor';
    container.innerHTML = `<div class="writing-toolbar" role="toolbar" aria-label="文档格式"><button type="button" data-command="bold" aria-label="加粗"><b>粗体</b></button><button type="button" data-command="italic">斜体</button><button type="button" data-command="formatBlock" data-value="h2">标题</button><button type="button" data-command="formatBlock" data-value="p">正文</button><button type="button" data-command="insertUnorderedList">列表</button><button type="button" data-command="insertOrderedList">编号</button><button type="button" data-link>文字链接</button><button type="button" data-image>插图</button><button type="button" data-document>上传文档</button><button type="button" data-command="undo">撤销</button></div><div class="writing-page document-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="正文编辑区" spellcheck="false"></div><label>关联链接（可选）<input class="field writing-source" type="url" placeholder="https://…" value="${escape(initial.sourceUrl)}"></label><div class="writing-attachments"></div><input type="file" class="writing-image-file" accept="image/png,image/jpeg,image/webp" multiple hidden><input type="file" class="writing-document-file" accept=".pdf,.doc,.docx,.txt,.md,.odt" multiple hidden><small>正文可随时插图；文档支持 PDF、Word、TXT、Markdown、ODT，每个最多 10 MB。</small><p class="writing-status" role="status" aria-live="polite"></p><p class="writing-error" role="alert"></p>`;
    textarea.after(container); textarea.hidden = true; textarea.required = false;
    const page = container.querySelector('.writing-page'), source = container.querySelector('.writing-source');
    page.innerHTML = initial.document ? renderNodes(initial.document) : `<p>${escape(textarea.value).replace(/\n/g,'<br>')}</p>`;
    const model = {attachments:initial.attachments || [], page, key, busy:false, range:null, changed:false, completed:false};
    form._writing = model;
    const error = message => { container.querySelector('.writing-error').textContent = message; };
    const status = message => { container.querySelector('.writing-status').textContent = message; };
    const collect = () => ({ document:serialize(page), sourceUrl:source.value, attachments:[...model.attachments] });
    function stash() {
      if (model.completed) return;
      const fields = {};
      for (const field of form.elements) if (field.name && !['password','file','hidden'].includes(field.type) && !/password/i.test(field.name)) fields[field.name] = field.value;
      textarea.value = page.innerText;
      fields.content = textarea.value;
      const ok = local.set(key,{...collect(),fields,...(model.draftId ? {draftId:model.draftId} : {}),updatedAt:new Date().toISOString()});
      status(ok ? '已保存到当前浏览器' : '浏览器无法保存草稿，请手动保存或保持页面打开');
      model.changed = true; onChange();
    }
    model.collect = collect; model.stash = stash; model.status = status; model.error = error;
    function remember() { const sel = getSelection(); if (sel?.rangeCount && page.contains(sel.anchorNode)) model.range = sel.getRangeAt(0).cloneRange(); }
    function restore() { page.focus(); const sel = getSelection(); if (model.range && page.contains(model.range.startContainer)) { sel.removeAllRanges(); sel.addRange(model.range); } else { const r = document.createRange(); r.selectNodeContents(page); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); } }
    function insert(html) { restore(); document.execCommand('insertHTML',false,html); remember(); stash(); }
    function attachmentList() { container.querySelector('.writing-attachments').innerHTML = model.attachments.map((id,i) => `<div><a href="/api/documents/${escape(id)}" target="_blank" rel="noopener">📎 ${escape(files.get(id)?.name || `文档 ${i+1}`)}</a><button type="button" data-remove-file="${escape(id)}" aria-label="移除附件">移除</button></div>`).join(''); }
    attachmentList();
    page.addEventListener('keyup',remember); page.addEventListener('mouseup',remember); page.addEventListener('focusout',remember);
    form.addEventListener('input',stash);
    container.querySelector('.writing-toolbar').addEventListener('mousedown',e => { if (e.target.closest('button')) e.preventDefault(); });
    container.addEventListener('click', e => {
      const button = e.target.closest('button'); if (!button || model.busy) return;
      error('');
      if (button.dataset.command) { restore(); document.execCommand(button.dataset.command,false,button.dataset.value || null); remember(); stash(); }
      if (button.hasAttribute('data-link')) { remember(); const href = prompt('请输入完整的 http 或 https 链接'); if (href == null) return; if (!url(href)) return error('请填写有效的 http 或 https 链接'); restore(); if (getSelection().isCollapsed) insert(`<a href="${escape(url(href))}">${escape(href)}</a>`); else { document.execCommand('createLink',false,url(href)); stash(); } }
      if (button.hasAttribute('data-image')) { remember(); container.querySelector('.writing-image-file').click(); }
      if (button.hasAttribute('data-document')) container.querySelector('.writing-document-file').click();
      if (button.dataset.removeFile) { model.attachments = model.attachments.filter(id => id !== button.dataset.removeFile); attachmentList(); stash(); }
    });
    async function upload(selected, image) {
      if (model.busy) return;
      model.busy = true; error(''); status('正在上传，请稍候…');
      const submits = [...form.querySelectorAll('[type="submit"], [data-save-draft]')];
      submits.forEach(b => b.disabled = true);
      try {
        for (const file of selected) {
          if (file.size > (image ? 2000000 : 10000000)) throw new Error(image ? '图片不能超过 2 MB' : '文档不能超过 10 MB');
          if (!image && model.attachments.length >= 10) throw new Error('最多添加 10 个文档');
          const data = await dataUrl(file);
          if (image) { const value = await api('/api/writing/images','POST',{image:data}); if (form.isConnected) insert(`<p><img src="${escape(value.url)}" alt="${escape(file.name)}"></p><p><br></p>`); }
          else { const value = await api('/api/documents','POST',{name:file.name,data:data.split(',')[1]}); files.set(value.id,value); model.attachments.push(value.id); attachmentList(); if (/\.(txt|md)$/i.test(file.name) && !page.innerText.trim() && !page.querySelector('img')) { const text = await file.text(); if (text.length > 100000) throw new Error('文档已作为附件上传，正文导入最多 10 万字'); page.innerHTML = `<p>${escape(text).replace(/\n/g,'<br>')}</p>`; } }
        }
      } catch (problem) { error(problem.message); }
      finally { model.busy = false; submits.forEach(b => b.disabled = false); stash(); }
    }
    container.querySelector('.writing-image-file').addEventListener('change',e => { const list = [...e.target.files]; e.target.value=''; upload(list,true); });
    container.querySelector('.writing-document-file').addEventListener('change',e => { const list = [...e.target.files]; e.target.value=''; upload(list,false); });
    page.addEventListener('paste',e => {
      e.preventDefault(); const images = [...e.clipboardData.files].filter(f => f.type.startsWith('image/'));
      if (images.length) { remember(); upload(images,true); return; }
      const html = e.clipboardData.getData('text/html');
      if (html) { const parsed = new DOMParser().parseFromString(html,'text/html'); insert(renderNodes(serialize(parsed.body))); }
      else insert(escape(e.clipboardData.getData('text/plain')).replace(/\n/g,'<br>'));
    });
    page.addEventListener('drop',e => { e.preventDefault(); if (e.dataTransfer.files.length) { remember(); const list=[...e.dataTransfer.files]; upload(list,list.every(f=>f.type.startsWith('image/'))); } });
    return model;
  }
  async function open(options, context) {
    if (active && !await beforeClose()) return;
    const {type,post,section='learning',draft:provided} = options;
    let draft = provided;
    if (post && !draft) {
      try { draft = (await api('/api/drafts')).find(d => d.postId === post.id); } catch (e) { context.toast(e.message); return; }
    }
    const value = draft || post || {type,section};
    const key = `blog-writing:post:${draft?.id || post?.id || type+':'+section}`;
    const recovered = local.get(key);
    const id = draft?.id || recovered?.draftId || crypto.randomUUID();
    context.openModal(`<section class="writer-heading"><span class="journal-kicker">MY WRITING DESK</span><h2>${post ? '编辑' : '写下'}${({article:'个人文章',life:'生活日记',study:'学习与工作记录',update:'更新日志'})[value.type]}</h2><p>慢慢写，草稿会自动保存。发布后访客才能看到。</p></section><form id="writer-form"><input type="hidden" name="type" value="${escape(value.type)}">${value.type === 'study' ? `<label>分类<select class="field" name="section"><option value="learning" ${value.section !== 'work' ? 'selected' : ''}>学习内容</option><option value="work" ${value.section === 'work' ? 'selected' : ''}>工作内容</option></select></label>`:''}<label>标题<input class="field" name="title" maxlength="100" value="${escape(value.title)}"></label><label>标签<input class="field" name="tag" maxlength="30" value="${escape(value.tag)}"></label><label>正文<textarea name="content" class="field">${escape(value.content)}</textarea></label><div class="writing-actions"><button type="button" class="quiet-button" data-save-draft>保存草稿</button><button type="button" class="quiet-button" data-open-drafts>草稿箱</button><button type="submit" class="btn">${post || draft?.postId ? '发布修改' : '发布'}</button></div></form>`);
    const form = document.querySelector('#writer-form');
    let timer, chain = Promise.resolve(), revision = draft?.revision, savedFingerprint = '', conflict = false;
    const collect = () => ({...Object.fromEntries(new FormData(form)), ...model.collect(), images:value.images || [], postId:draft?.postId || post?.id});
    const save = () => {
      clearTimeout(timer);
      chain = chain.catch(()=>{}).then(async () => {
        if (model.completed || model.busy || !form.isConnected) return;
        if (conflict) throw new Error('草稿已在其他窗口更新，请保留本地内容并重新打开草稿');
        const fields=collect(), fingerprint=JSON.stringify(fields);
        if (fingerprint === savedFingerprint) return;
        model.status('正在保存到服务器…');
        try {
          const result = await api(`/api/drafts/${id}`,'PUT',{...fields,revision});
          revision = result.revision; savedFingerprint = fingerprint;
          const stored = local.get(key); if (stored) local.set(key,{...stored,draftId:id});
          model.status('草稿已保存到服务器'); model.error('');
        } catch(e) { if (/其他窗口/.test(e.message)) conflict = true; model.error(e.message); throw e; }
      });
      return chain;
    };
    const model = enhance(form,value,key,()=> { clearTimeout(timer); timer=setTimeout(()=>save().catch(()=>{}),1200); });
    model.draftId = id;
    const originalStash = model.stash;
    model.stash = () => { originalStash(); const v=local.get(key); if(v)local.set(key,{...v,draftId:id}); };
    active = {form,model,save,context};
    form.querySelector('[data-save-draft]').onclick = () => save().then(()=>context.toast('草稿已保存')).catch(e=>model.error(e.message));
    form.querySelector('[data-open-drafts]').onclick = () => drafts(context);
    form.addEventListener('submit',async e => {
      e.preventDefault(); e.stopPropagation(); if(model.busy)return;
      const button=form.querySelector('[type="submit"]'); button.disabled=true;
      try {
        await save();
        const result=await api(`/api/drafts/${id}/publish`,'POST',{revision});
        model.completed=true; local.remove(key); forgetDraft(id,draft?.postId || post?.id); active=null;
        await context.published(result); context.toast('已发布，草稿已移出草稿箱');
      } catch(problem) { model.error(problem.message); button.disabled=false; }
    });
    if (recovered) { model.status('已恢复当前浏览器中尚未发布的内容'); timer=setTimeout(()=>save().catch(()=>{}),1200); }
    form.elements.title.focus();
  }
  async function beforeClose() {
    if (!active) return true;
    if (active.model.busy) { active.model.error('文件正在上传，请等待上传结束'); return false; }
    const {model,save}=active;
    if (model.completed) {active=null;return true;}
    try { if(model.changed)await save(); active=null;return true; }
    catch { model.error('服务器保存失败，内容仍保留在当前浏览器，请重试保存'); return false; }
  }
  async function drafts(context) {
    if (!await beforeClose()) return;
    try {
      const list=await api('/api/drafts');
      context.openModal(`<h2>草稿箱</h2><p>只有管理员可见，发布后自动移出。</p><div class="writing-draft-list">${list.map(d=>`<article><h3>${escape(d.title || '未命名草稿')}</h3><p>${escape(d.content.slice(0,80))}</p><small>${new Date(d.updatedAt).toLocaleString('zh-CN')}</small><div><button type="button" class="btn tiny" data-resume="${escape(d.id)}">继续编辑</button><button type="button" class="quiet-button" data-delete-draft="${escape(d.id)}">删除草稿</button></div></article>`).join('') || '<p>还没有草稿，开始写下第一段内容吧。</p>'}</div>`);
      document.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>{const draft=list.find(d=>d.id===b.dataset.resume);open({type:draft.type,draft},context);});
      document.querySelectorAll('[data-delete-draft]').forEach(b=>b.onclick=async()=>{if(!confirm('确定删除这份草稿？'))return;try{await api(`/api/drafts/${b.dataset.deleteDraft}`,'DELETE');forgetDraft(b.dataset.deleteDraft);await drafts(context);}catch(e){context.toast(e.message);}});
    } catch(e) {context.toast(e.message);}
  }
  function enhanceComments() {
    for (const form of document.querySelectorAll('#topic-form, #topic-edit-form, .reply-form')) {
      const key=`blog-writing:comment:${form.id || 'reply'}:${form.dataset.topic || form.dataset.id || 'new'}`;
      const model=enhance(form,form._initialWriting || {},key);
      if (model && !form.querySelector('[data-comment-save]')) {
        const button=document.createElement('button'); button.type='button';button.className='quiet-button';button.dataset.commentSave='';button.textContent='保存草稿';
        button.addEventListener('click',()=>model.stash());form.querySelector('[type="submit"]').before(button);
      }
    }
  }
  function values(form) { return form._writing ? form._writing.collect() : {}; }
  function completed(form) { if(form._writing){ form._writing.completed=true;local.remove(form._writing.key); } }
  const observer=new MutationObserver(enhanceComments);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('beforeunload',e=>{if(active?.model.busy){e.preventDefault();e.returnValue='';}});
  window.BlogWriter={open,drafts,beforeClose,isActive:()=>Boolean(active),render,values,completed,enhanceComments,renderNodes};
  api('/api/documents/metadata').then(list=>list.forEach(file=>files.set(file.id,file))).catch(()=>{});
})();
