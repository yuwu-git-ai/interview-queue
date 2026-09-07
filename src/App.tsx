import { useEffect, useState } from 'react';
import type { FrontStore } from '@/src/lib/store';
import { getStore } from '@/src/lib/store';
import ScreenView from '@/src/views/screen/ScreenView';
import RegisterView from '@/src/views/register/RegisterView';
import InterviewerView from '@/src/views/interviewer/InterviewerView';

function useView(): string {
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') || 'screen');
  useEffect(() => {
    const onPop = () => setView(new URLSearchParams(window.location.search).get('view') || 'screen');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return view;
}

export default function App() {
  const view = useView();
  const [store, setStore] = useState<FrontStore | null>(null);
  const [, setVersion] = useState(0);

  useEffect(() => {
    getStore().then((s) => {
      setStore(s);
      s.refresh().catch(() => {});
    });
  }, []);
  useEffect(() => {
    if (!store) return;
    const unsub = store.subscribe(() => setVersion((v) => v + 1));
    const timer = setInterval(() => {
      store.refresh().catch(() => {});
    }, 2000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [store]);

  if (!store) return <div className="grid h-full place-items-center text-slate-500">加载中…</div>;

  return (
    <div className="h-full">
      {store.kind === 'local' && (
        <div className="bg-amber-100 px-3 py-1 text-center text-xs text-amber-800">
          离线演示模式：后端未连接，数据仅存本机浏览器
        </div>
      )}
      {view === 'screen' && <ScreenView store={store} />}
      {view === 'register' && <RegisterView store={store} />}
      {view === 'interviewer' && <InterviewerView store={store} />}
      {!['screen', 'register', 'interviewer'].includes(view) && (
        <div className="grid h-full place-items-center">
          <div className="text-center">
            <p className="text-lg font-bold">未知视图：{view}</p>
            <p className="mt-2 text-sm text-slate-500">
              可用：<code>?view=screen</code> · <code>?view=register</code> · <code>?view=interviewer</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
