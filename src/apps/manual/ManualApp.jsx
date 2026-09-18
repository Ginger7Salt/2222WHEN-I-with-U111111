import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  ExternalLink,
  FileText,
  GraduationCap,
  Heart,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Server,
  Settings2,
  Sparkles,
} from 'lucide-react';

/**
 * 教程目录地址。
 *
 * 对应项目目录：
 * public/tutorials/index.json
 */
const TUTORIAL_INDEX_URL = '/tutorials/index.json';

/**
 * 教程图标。
 *
 * 不需要动态安装图标依赖。
 * 以后在 index.json 中填写 icon 名称即可。
 */
const TUTORIAL_ICON_MAP = {
  book: BookOpen,
  server: Server,
  health: Heart,
  cloud: Server,
  coffee: Sparkles,
  settings: Settings2,
  file: FileText,
  default: FileText,
};

function getTutorialIcon(iconName) {
  return (
    TUTORIAL_ICON_MAP[iconName] ||
    TUTORIAL_ICON_MAP.default
  );
}

function normalizeTutorialEntry(item = {}) {
  return {
    id: String(
      item.id ||
      item.slug ||
      item.title ||
      `tutorial-${Date.now()}`,
    ),
    title: item.title || '未命名教程',
    summary: item.summary || '暂无教程简介。',
    category: item.category || '使用教程',
    theme: item.theme || 'default',
    icon: item.icon || 'book',
    updatedAt: item.updatedAt || '',
    source: item.source || '',
    blocks: item.blocks || item.sections || item.content || null,
  };
}

function resolveTutorialUrl(source) {
  if (!source) {
    return '';
  }

  if (
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('/')
  ) {
    return source;
  }

  if (typeof window === 'undefined') {
    return source;
  }

  return new URL(
    source,
    new URL(TUTORIAL_INDEX_URL, window.location.href),
  ).toString();
}

async function fetchTutorialJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `教程文件加载失败：${response.status}`,
    );
  }

  return response.json();
}

function normalizeTutorialBlocks(tutorial) {
  const blocks =
    tutorial?.blocks ||
    tutorial?.sections ||
    tutorial?.content ||
    [];

  if (Array.isArray(blocks)) {
    return blocks;
  }

  if (typeof blocks === 'string' && blocks.trim()) {
    return [
      {
        type: 'paragraph',
        text: blocks,
      },
    ];
  }

  return [];
}

function TutorialCodeBlock({ block }) {
  const [copied, setCopied] = useState(false);

  const code = block.code || block.text || '';

  const handleCopy = async () => {
    if (!navigator?.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="tutorial-code-block">
      <div className="tutorial-code-block__header">
        <span>
          {block.label || block.language || 'CODE'}
        </span>

        {code && (
          <button
            type="button"
            onClick={handleCopy}
            className="tutorial-code-block__copy"
          >
            {copied ? '已复制' : '复制'}
          </button>
        )}
      </div>

      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TutorialStep({ item, index }) {
  return (
    <div className="tutorial-step">
      <div className="tutorial-step__number">
        {String(index + 1).padStart(2, '0')}
      </div>

      <div className="tutorial-step__content">
        {item.title && (
          <h4>{item.title}</h4>
        )}

        {(item.body || item.description) && (
          <p>
            {item.body || item.description}
          </p>
        )}

        {item.code && (
          <TutorialCodeBlock
            block={{
              type: 'code',
              code: item.code,
              language: item.language,
            }}
          />
        )}

        {item.note && (
          <div className="tutorial-inline-note">
            {item.note}
          </div>
        )}
      </div>
    </div>
  );
}

function TutorialBlock({ block, index }) {
  if (!block) {
    return null;
  }

  const type = block.type || 'paragraph';

  if (type === 'steps' || type === 'step-list') {
    return (
      <section
        className="tutorial-block tutorial-block--steps"
        key={index}
      >
        {block.title && (
          <h3>{block.title}</h3>
        )}

        <div className="tutorial-steps">
          {(block.items || []).map((item, itemIndex) => (
            <TutorialStep
              key={`${index}-${itemIndex}`}
              item={item}
              index={itemIndex}
            />
          ))}
        </div>
      </section>
    );
  }

  if (type === 'checklist') {
    return (
      <section
        className="tutorial-block tutorial-block--checklist"
        key={index}
      >
        {block.title && (
          <h3>{block.title}</h3>
        )}

        <ul className="tutorial-checklist">
          {(block.items || []).map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>
              <span className="tutorial-checklist__mark">
                ✓
              </span>

              <span>
                {typeof item === 'string'
                  ? item
                  : item.text || item.title}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (type === 'code') {
    return (
      <section
        className="tutorial-block"
        key={index}
      >
        {block.title && (
          <h3>{block.title}</h3>
        )}

        <TutorialCodeBlock block={block} />
      </section>
    );
  }

  if (type === 'note' || type === 'warning') {
    const noteType =
      type === 'warning'
        ? 'tutorial-callout--warning'
        : 'tutorial-callout--note';

    return (
      <aside
        className={`tutorial-callout ${noteType}`}
        key={index}
      >
        <AlertTriangle
          className="tutorial-callout__icon"
          size={17}
          strokeWidth={1.7}
        />

        <div>
          {block.title && (
            <strong>{block.title}</strong>
          )}

          <p>
            {block.text || block.body || block.content}
          </p>
        </div>
      </aside>
    );
  }

  if (type === 'links') {
    return (
      <section
        className="tutorial-block"
        key={index}
      >
        {block.title && (
          <h3>{block.title}</h3>
        )}

        <div className="tutorial-links">
          {(block.items || []).map((item, itemIndex) => (
            <a
              key={`${index}-${itemIndex}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="tutorial-link"
            >
              <span>
                {item.title || item.label || item.url}
              </span>

              <ExternalLink
                size={14}
                strokeWidth={1.6}
              />
            </a>
          ))}
        </div>
      </section>
    );
  }

  if (type === 'divider') {
    return (
      <div
        className="tutorial-divider"
        key={index}
      />
    );
  }

  return (
    <section
      className="tutorial-block tutorial-block--paragraph"
      key={index}
    >
      {block.title && (
        <h3>{block.title}</h3>
      )}

      <p>
        {block.text || block.body || block.content}
      </p>
    </section>
  );
}

function TutorialDetail({ tutorial, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="tutorial-empty-state">
        <RefreshCw
          className="tutorial-empty-state__icon tutorial-spin"
          size={24}
          strokeWidth={1.5}
        />

        <h3>正在打开教程</h3>
        <p>正在读取教程内容，请稍候。</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tutorial-empty-state tutorial-empty-state--error">
        <AlertTriangle
          className="tutorial-empty-state__icon"
          size={24}
          strokeWidth={1.5}
        />

        <h3>教程暂时无法打开</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!tutorial) {
    return (
      <div className="tutorial-empty-state">
        <FileText
          className="tutorial-empty-state__icon"
          size={24}
          strokeWidth={1.5}
        />

        <h3>选择一个教程</h3>
        <p>从左侧选择教程后，这里会显示详细内容。</p>
      </div>
    );
  }

  const TutorialIcon = getTutorialIcon(tutorial.icon);
  const blocks = normalizeTutorialBlocks(tutorial);
  const theme = String(
    tutorial.theme || 'default',
  ).replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <article
      className={`tutorial-detail tutorial-theme-${theme}`}
    >
      <header className="tutorial-detail__header">
        <div className="tutorial-detail__eyebrow">
          <span>{tutorial.category}</span>

          {tutorial.updatedAt && (
            <span>
              更新于 {tutorial.updatedAt}
            </span>
          )}
        </div>

        <div className="tutorial-detail__identity">
          <div className="tutorial-detail__icon">
            <TutorialIcon
              size={22}
              strokeWidth={1.5}
            />
          </div>

          <div>
            <h2>{tutorial.title}</h2>
            <p>{tutorial.summary}</p>
          </div>
        </div>
      </header>

      <div className="tutorial-detail__body">
        {blocks.length > 0 ? (
          blocks.map((block, index) => (
            <TutorialBlock
              key={`${tutorial.id}-${index}`}
              block={block}
              index={index}
            />
          ))
        ) : (
          <div className="tutorial-empty-state">
            <FileText
              className="tutorial-empty-state__icon"
              size={24}
              strokeWidth={1.5}
            />

            <h3>教程内容为空</h3>
            <p>
              请在对应的 JSON 教程文件中添加 blocks。
            </p>
          </div>
        )}
      </div>

      <footer className="tutorial-detail__footer">
        <span>WHEN I with U</span>
        <span>—</span>
        <span>TUTORIALS</span>
      </footer>
    </article>
  );
}

function TutorialLibrary() {
  const [tutorials, setTutorials] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [activeTutorial, setActiveTutorial] = useState(null);
  const [isIndexLoading, setIsIndexLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [indexError, setIndexError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadIndex = async () => {
      setIsIndexLoading(true);
      setIndexError('');

      try {
        const payload = await fetchTutorialJson(
          TUTORIAL_INDEX_URL,
        );

        const list = Array.isArray(payload)
          ? payload
          : payload.tutorials || [];

        const normalizedList = list.map(
          normalizeTutorialEntry,
        );

        if (cancelled) {
          return;
        }

        setTutorials(normalizedList);

        setActiveId((currentId) => {
          const currentExists = normalizedList.some(
            (item) => item.id === currentId,
          );

          return currentExists
            ? currentId
            : normalizedList[0]?.id || '';
        });
      } catch (error) {
        if (!cancelled) {
          setIndexError(
            error?.message ||
              '教程目录加载失败。',
          );
        }
      } finally {
        if (!cancelled) {
          setIsIndexLoading(false);
        }
      }
    };

    loadIndex();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const activeEntry = useMemo(
    () =>
      tutorials.find(
        (tutorial) => tutorial.id === activeId,
      ) || null,
    [tutorials, activeId],
  );

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!activeEntry) {
        setActiveTutorial(null);
        return;
      }

      setDetailError('');

      if (activeEntry.blocks) {
        setActiveTutorial(activeEntry);
        setIsDetailLoading(false);
        return;
      }

      if (!activeEntry.source) {
        setActiveTutorial(activeEntry);
        setIsDetailLoading(false);
        return;
      }

      setIsDetailLoading(true);
      setActiveTutorial(null);

      try {
        const payload = await fetchTutorialJson(
          resolveTutorialUrl(activeEntry.source),
        );

        if (cancelled) {
          return;
        }

        setActiveTutorial({
          ...activeEntry,
          ...payload,
          id: payload.id || activeEntry.id,
          title: payload.title || activeEntry.title,
          summary:
            payload.summary || activeEntry.summary,
          category:
            payload.category || activeEntry.category,
          theme: payload.theme || activeEntry.theme,
          icon: payload.icon || activeEntry.icon,
        });
      } catch (error) {
        if (!cancelled) {
          setDetailError(
            error?.message ||
              '教程内容加载失败。',
          );
        }
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    };

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [activeEntry]);

  if (isIndexLoading) {
    return (
      <div className="tutorial-library">
        <div className="tutorial-library__loading">
          <RefreshCw
            className="tutorial-spin"
            size={20}
            strokeWidth={1.5}
          />

          正在读取教程目录
        </div>
      </div>
    );
  }

  if (indexError) {
    return (
      <div className="tutorial-library">
        <div className="tutorial-empty-state tutorial-empty-state--error">
          <AlertTriangle
            className="tutorial-empty-state__icon"
            size={24}
            strokeWidth={1.5}
          />

          <h3>教程目录暂时无法读取</h3>
          <p>{indexError}</p>

          <button
            type="button"
            className="tutorial-retry-button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            <RefreshCw
              size={14}
              strokeWidth={1.6}
            />
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tutorial-library">
      <div className="tutorial-library__intro">
        <div>
          <span className="tutorial-library__eyebrow">
            A SMALL WORKSHOP
          </span>

          <h3>把复杂配置，拆成清晰步骤</h3>

          <p>
            教程内容独立存放在 tutorials 文件夹中。
            以后添加新教程时，不需要修改说明书 JSX。
          </p>
        </div>

        <div className="tutorial-library__count">
          <strong>{tutorials.length}</strong>
          <span>篇教程</span>
        </div>
      </div>

      {tutorials.length === 0 ? (
        <div className="tutorial-empty-state">
          <FileText
            className="tutorial-empty-state__icon"
            size={24}
            strokeWidth={1.5}
          />

          <h3>还没有教程</h3>
          <p>
            请在 public/tutorials/index.json
            中添加教程目录。
          </p>
        </div>
      ) : (
        <div className="tutorial-library__layout">
          <aside className="tutorial-library__nav">
            <div className="tutorial-library__nav-title">
              TUTORIAL INDEX
            </div>

            <div className="tutorial-library__cards">
              {tutorials.map((tutorial, index) => {
                const TutorialIcon = getTutorialIcon(
                  tutorial.icon,
                );

                const isActive =
                  tutorial.id === activeId;

                return (
                  <button
                    type="button"
                    key={tutorial.id}
                    className={`tutorial-card ${
                      isActive
                        ? 'tutorial-card--active'
                        : ''
                    } tutorial-card--${String(
                      tutorial.theme || 'default',
                    ).replace(
                      /[^a-zA-Z0-9_-]/g,
                      '',
                    )}`}
                    onClick={() =>
                      setActiveId(tutorial.id)
                    }
                  >
                    <span className="tutorial-card__number">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <span className="tutorial-card__icon">
                      <TutorialIcon
                        size={17}
                        strokeWidth={1.5}
                      />
                    </span>

                    <span className="tutorial-card__content">
                      <strong>{tutorial.title}</strong>
                      <small>{tutorial.summary}</small>
                    </span>

                    <ChevronRight
                      className="tutorial-card__arrow"
                      size={15}
                      strokeWidth={1.5}
                    />
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="tutorial-library__content">
            <TutorialDetail
              tutorial={activeTutorial}
              isLoading={isDetailLoading}
              error={detailError}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const MANUAL_SECTIONS = [
  {
    id: 'welcome',
    label: '序言',
    eyebrow: 'A PRIVATE SPACE',
    title: '欢迎来到 WHEN I with U',
    icon: Heart,
    content: (
      <>
        <div className="manual-note">
          <p>现在的正式中文名叫！熔巧机</p>
        </div>

        <p>
          选择这个名字，是因为我觉得两个人在一起的时间总是很宝贵。
          即使你的电子伴侣无法来到现实中，在这里 ta 也可以和你对话、和你交流，
          在一次次互动中逐渐了解你。
        </p>

        <p>
          如果你希望更方便地使用它，可以通过浏览器的“分享”功能将网站安装到手机主屏幕。
          建议先安装到主屏幕再设置，因为安装到主屏幕的时候不会保存数据。
        </p>

        <p>
          请注意，这个网站是完全不商业化的，并且之后也没有商业化的想法。
          网站地址可以二次分享，感谢您的分享。
          网站还在更新新的子app和部分页面美化。修改过程中可能会出现bug，都会尽快解决。
          小红薯的repo tag 就是 熔巧机~ 欢迎老师们repo！
          感谢老师们的谅解
        </p>

        <div className="manual-note">
          <p>
            注意避雷：网站依托调用 AI 让您的电子伴侣或伙伴和您对话。
            如果您不喜欢 AI 生成，可以点击右上角退出。
          </p>
        </div>
      </>
    ),
  },

  {
    id: 'author',
    label: '作者与联系',
    eyebrow: 'A NOTE FROM THE AUTHOR',
    title: '关于这间房子的作者',
    icon: Heart,
    content: (
      <div className="space-y-4">
        <ManualItem
          title="作者"
          description="玉元一 shadow"
        />

        <ManualItem
          title="QQ群：月光咖啡屋"
          description="811831045（审核群）"
        />

        <p>
          月光咖啡屋里主要会堆放一些我的产出，包括酒馆的角色卡、美化、预设、插件等。
          因为工作关系，更新可能不会很快；如果使用中遇到问题，也可以来咖啡屋问问。
        </p>

        <div className="manual-note">
          <p>审核会卡成年和女性哦。</p>
        </div>

        <p>
          如果对 WHEN I with U 的使用有疑问，也可以直接私信我。
        </p>

        <p>
          如果喜欢这个项目，也请老师们给我吃吃 repo 叭！
        </p>

        <div className="manual-note">
          <p>
            注意：您需要先去设置页面配置您的 API Key，才可以正常使用该网站。
          </p>
        </div>

        <p>
          根据 Base URL 和 Key 来填写，点击“连接”，然后选择模型并保存就可以啦。
        </p>
      </div>
    ),
  },

  {
    id: 'spaces',
    label: '空间索引',
    eyebrow: 'THE ROOMS',
    title: '每个空间，都有自己的用途',
    icon: BookOpen,
    content: (
      <div className="space-y-4">
        <ManualItem
          title="Hub"
          description="整个空间的入口。查看角色、置顶影像、快速记录，以及进入其他子空间。"
        />

        <ManualItem
          title="Messages"
          description="与角色进行一对一的长期交流。需要注意的是，几乎所有其他空间都不会读取你与角色在消息框中的聊天记录，只会获取角色的基础资料数据。"
        />

        <ManualItem
          title="聊天界面顶部"
          description="从左往右分别是“平行轨迹”和“时间票据”。平行轨迹用于记录角色在你不在的时候都做了什么，这部分内容由 AI 自动生成；角色正在和你聊天的时候不会生成平行轨迹。时间票据用于记录角色主动决定的后续联系，例如设定十分钟之后主动发消息，或者角色想在半小时后确认你的心情是否好一些。"
        />

        <ManualItem
          title="Diaries"
          description="保存独自书写或与角色共同留下的日记片段。角色也可以主动向你发送日记。您也可以写了日记之后发送给角色，角色会给您回信。"
        />

        <ManualItem
          title="Travel"
          description="与角色一起去旅行，并保存旅途中寄回来的小记录。"
        />

        <ManualItem
          title="Snapshots"
          description="保存像拍立得一样的瞬间、影像与相关评论。角色之间也可以在这里互动。"
        />

        <ManualItem
          title="Pebbling"
          description="一个可以随便说些什么、留下轻小片段的地方。"
        />

        <ManualItem
          title="Imaginarium"
          description="虚拟群聊空间。填写群聊信息后，可以设定多个角色一起聊天。"
        />

        <ManualItem
          title="The Ensemble"
          description="从角色库中选择多个角色，将他们带入同一个群聊。你也可以在这里拥有多个身份。"
        />

        <ManualItem
          title="Living Habitat"
          description="观察角色共同守护的生态空间与生命记录。"
        />

        <ManualItem
          title="Ephemera"
          description="将日常事件保存成票根、收据、卡片或其他可以收藏的物件。"
        />

        <ManualItem
          title="Memory"
          description="在这里你可以看到你和角色在不同消息框里留下的记忆，可以对它们进行编辑和删除。"
        />

        <div className="manual-note">
          <p>新的 App 正在逐渐推出中！</p>
        </div>
      </div>
    ),
  },

  {
    id: 'getting-started',
    label: '开始使用',
    eyebrow: 'FIRST STEPS',
    title: '第一次进入时，可以这样开始',
    icon: Sparkles,
    content: (
      <ol className="manual-numbered-list">
        <li>
          <strong>先进入设置空间</strong>
          <span>
            在这里选择主题、调整首页标题，并完成基础配置。
            可以接入 MCP，目前 MCP 只有在 Messages 的一对一沟通中才可以使用。
            在角色界面可以为角色配置 MiniMax 声音生成。需要部署跨域哦！
          </span>
        </li>

        <li>
          <strong>添加一个角色</strong>
          <span>
            角色是这个私人空间的核心。完成角色资料后，其他陪伴功能才会逐渐展开。
          </span>
        </li>

        <li>
          <strong>配置自己的 AI 服务</strong>
          <span>
            填写兼容的 API 地址、密钥和模型，然后使用连通性测试确认配置。
          </span>
        </li>

        <li>
          <strong>回到 Hub</strong>
          <span>
            从这里开始查看空间中的日常痕迹，并按照自己的需要进入不同区域。
          </span>
        </li>
      </ol>
    ),
  },

  {
    id: 'mcp',
    label: 'MCP 支持',
    eyebrow: 'MCP INTEGRATIONS',
    title: '让外部服务进入对话',
    icon: Server,
    content: (
      <div className="space-y-4">
        <p>
          现在可以通过 MCP 连接更多外部服务，并在 Messages
          的一对一沟通中渲染对应的小卡片。
        </p>

        <ManualItem
          title="当前兼容的 MCP 服务"
          description="麦当劳、滴滴打车、Apple Watch、天气、Apple 健康、网易云音乐、瑞幸咖啡。"
        />

        <div className="manual-note">
          <p>
            MCP 可以将外部服务中的信息以渲染小卡片的形式带入对话，
            让角色与你的日常生活、出行、饮食、健康和音乐更加自然地连接起来。
          </p>
        </div>

        <p>
          不同 MCP 服务可能需要单独配置服务器地址、授权信息或其他权限。
          具体配置步骤请进入“教程中心”查看。
        </p>
      </div>
    ),
  },

  {
    id: 'tutorials',
    label: '教程中心',
    eyebrow: 'THE WORKSHOP',
    title: '配置教程与使用指南',
    icon: GraduationCap,
    content: <TutorialLibrary />,
  },

  {
    id: 'daily-offering',
    label: '今日留物',
    eyebrow: 'A SMALL OFFERING',
    title: '只属于今天的一件小东西',
    icon: MessageCircle,
    content: (
      <>
        <p>
          今日留物是角色每天留下的一次轻量陪伴。它可能是一首歌、一张图片，
          或者一句只在今天出现的寄语。
        </p>

        <p>
          它不会成为任务，只是短暂地出现在这里，等你偶然发现。
        </p>

        <div className="manual-note">
          <p>
            当天没有点击右上角关闭按钮时，刷新页面后仍然可以看到同一份留物。
          </p>
        </div>

        <p>
          一旦主动关闭，它便不会在当天再次出现。第二天进入 Hub 时，
          空间会准备一份新的内容。
        </p>

        <p>
          音乐由于版权原因只可以预览一小段。
        </p>
      </>
    ),
  },

  {
    id: 'settings',
    label: '设置说明',
    eyebrow: 'TUNING THE ROOM',
    title: '让空间更接近你的习惯',
    icon: Settings2,
    content: (
      <div className="space-y-4">
        <ManualItem
          title="视觉美学"
          description="切换空间主题，并决定是否在主页保留文学化标题。"
        />

        <ManualItem
          title="陪伴频率"
          description="控制日常自动消息，以及安静时段的范围。如果您想要收到系统通知，请开启系统通知的设置。"
        />

        <ManualItem
          title="锁屏台词陪伴"
          description="管理锁屏媒体卡片中可以出现的陪伴台词。"
        />

        <ManualItem
          title="AI 心灵连通"
          description="配置你自己的 OpenAI-compatible API 服务。API Key 仅保存在本地设备中。"
        />

        <ManualItem
          title="今日留物"
          description="选择角色、管理图片盒，以及调整今日留物相关内容。"
        />

        <ManualItem
          title="数据与本地存储"
          description="查看浏览器存储情况，并导出或恢复本地数据。"
        />
      </div>
    ),
  },

  {
    id: 'privacy',
    label: '数据与隐私',
    eyebrow: 'KEPT LOCALLY',
    title: '你的记录，留在自己的设备里',
    icon: LockKeyhole,
    content: (
      <>
        <p>
          WHEN I with U 使用浏览器本地数据库保存角色、消息、影像和其他生活记录。
        </p>

        <p>
          这些内容不会因为打开另一个页面而自动上传到某个公共账户。
          只有在使用你配置的 AI 服务时，相关请求内容才会发送到对应的 API 服务。
        </p>

        <p>
          如果你清除浏览器站点数据，或者卸载应用而没有提前备份，
          本地记录可能会丢失。因此，重要内容建议定期导出备份。
        </p>

        <div className="manual-note">
          <Database
            className="h-4 w-4 shrink-0"
            strokeWidth={1.6}
          />

          <p>
            导入备份会覆盖当前设备上的本地记录。
            执行前请确认文件来源，并在必要时先导出当前数据。
          </p>
        </div>
      </>
    ),
  },

  {
    id: 'faq',
    label: '常见问题',
    eyebrow: 'A FEW NOTES',
    title: '使用时可能遇到的情况',
    icon: CircleHelp,
    content: (
      <div className="space-y-4">
        <ManualItem
          title="为什么某些图片或音乐无法打开？"
          description="外部媒体受到网络、地区、版权和来源服务状态影响。基础内容不会因此无法保存。"
        />

        <ManualItem
          title="刷新后内容不见了怎么办？"
          description="大多数内容会保存在本地数据库中。请先确认浏览器没有处于无痕模式，也没有清除站点数据。"
        />

        <ManualItem
          title="教程为什么没有显示？"
          description="请确认 public/tutorials/index.json 文件存在，并且 JSON 格式正确。教程中的 source 路径需要和实际文件路径对应。"
        />
      </div>
    ),
  },
];

export function ManualItem({ title, description }) {
  return (
    <div className="manual-item">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export const ManualApp = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState('welcome');

  const currentSection =
    MANUAL_SECTIONS.find(
      (section) => section.id === activeSection,
    ) || MANUAL_SECTIONS[0];

  const SectionIcon = currentSection.icon;

  return (
    <div className="manual-page">
      <header className="manual-header">
        <button
          type="button"
          onClick={onBack}
          className="manual-back-button"
          aria-label="返回设置"
          title="返回设置"
        >
          <ArrowLeft
            className="h-4 w-4"
            strokeWidth={1.7}
          />
        </button>

        <div className="manual-header__title">
          <span>THE HOUSE MANUAL</span>
          <h1>空间说明书</h1>
        </div>

        <div className="manual-header__mark">
          <BookOpen
            className="h-4 w-4"
            strokeWidth={1.5}
          />
        </div>
      </header>

      <section className="manual-intro">
        <p className="manual-intro__eyebrow">
          WHEN I WITH U / NOTES FOR LIVING HERE
        </p>

        <h2>
          一份简单的
          <br />
          使用说明
        </h2>

        <p>
          感谢您的使用
        </p>
      </section>

      <nav
        className="manual-index"
        aria-label="说明书目录"
      >
        <div className="manual-index__label">
          CONTENTS
        </div>

        <div className="manual-index__list">
          {MANUAL_SECTIONS.map((section, index) => {
            const Icon = section.icon;
            const isActive =
              section.id === activeSection;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`manual-index__item ${
                  isActive
                    ? 'manual-index__item--active'
                    : ''
                }`}
              >
                <span className="manual-index__number">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <Icon
                  className="h-3.5 w-3.5"
                  strokeWidth={1.5}
                />

                <span>{section.label}</span>

                <ChevronRight
                  className="ml-auto h-3.5 w-3.5"
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>
      </nav>

      <article
        className="manual-article animate-fade-in-up"
        key={currentSection.id}
      >
        <div className="manual-article__topline">
          <span>{currentSection.eyebrow}</span>

          <span>
            {String(
              MANUAL_SECTIONS.indexOf(currentSection) + 1,
            ).padStart(2, '0')}
          </span>
        </div>

        <div className="manual-article__icon">
          <SectionIcon
            className="h-5 w-5"
            strokeWidth={1.4}
          />
        </div>

        <h2>{currentSection.title}</h2>

        <div className="manual-article__body">
          {currentSection.content}
        </div>

        <div className="manual-article__footer">
          <span>WHEN I with U</span>
          <span>—</span>
          <span>KEEP WHAT MATTERS</span>
        </div>
      </article>

      <p className="manual-page__footer">
        by shadow
      </p>
    </div>
  );
};

export default ManualApp;
