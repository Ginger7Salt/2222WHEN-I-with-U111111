import React from 'react';
import { MapPin } from 'lucide-react';

// metadata: { name, note }
// 由 aiService 解析 [LOCATION: 地点名称 | 附加感想] 得到
const LocationCard = ({ metadata = {}, isUser = false }) => {
  const name = metadata?.name?.trim() || '未知地点';
  const note = metadata?.note?.trim() || '';

  const theme = false
    ? {
        cardBackground: '#111111',
        cardBorder: '#111111',
        mainText: '#ffffff',
        secondaryText: 'rgba(255, 255, 255, 0.62)',
        iconBackground: '#ffffff',
        iconColor: '#111111',
        mapBackground: '#30302e',
        mapRoad: '#686864',
        mapSecondaryRoad: 'rgba(255, 255, 255, 0.92)',
        mapWater: '#3b4847',
        mapPark: '#3c443c',
        mapLabel: 'rgba(255, 255, 255, 0.48)',
        mapScale: 'rgba(255, 255, 255, 0.62)',
        locationDot: '#ffffff',
        locationDotBorder: '#111111',
        locationRing: 'rgba(255, 255, 255, 0.24)',
      }
    : {
        cardBackground: '#ffffff',
        cardBorder: '#dededb',
        mainText: '#111111',
        secondaryText: '#777777',
        iconBackground: '#111111',
        iconColor: '#ffffff',
        mapBackground: '#e9e9e5',
        mapRoad: '#d0d0ca',
        mapSecondaryRoad: 'rgba(255, 255, 255, 0.95)',
        mapWater: '#d8e0df',
        mapPark: '#dfe4dc',
        mapLabel: '#8a8a84',
        mapScale: '#777770',
        locationDot: '#111111',
        locationDotBorder: '#ffffff',
        locationRing: 'rgba(17, 17, 17, 0.12)',
      };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '380px',
        minWidth: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: '22px',
        background: theme.cardBackground,
        color: theme.mainText,
        boxShadow: isUser
          ? '0 8px 24px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)'
          : '0 8px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* 模拟地图区域 */}
      <div
        aria-label={`地图预览：${name}`}
        style={{
          position: 'relative',
          height: '168px',
          overflow: 'hidden',
          backgroundColor: theme.mapBackground,
          backgroundImage: `
            linear-gradient(
              28deg,
              transparent 47%,
              ${theme.mapSecondaryRoad} 48%,
              ${theme.mapSecondaryRoad} 53%,
              transparent 54%
            ),
            linear-gradient(
              112deg,
              transparent 44%,
              ${theme.mapSecondaryRoad} 45%,
              ${theme.mapSecondaryRoad} 51%,
              transparent 52%
            ),
            linear-gradient(
              7deg,
              transparent 48%,
              rgba(170, 170, 164, 0.72) 49%,
              rgba(170, 170, 164, 0.72) 51%,
              transparent 52%
            ),
            linear-gradient(
              90deg,
              transparent 48%,
              rgba(180, 180, 174, 0.64) 49%,
              rgba(180, 180, 174, 0.64) 51%,
              transparent 52%
            )
          `,
          backgroundSize: '148px 116px, 180px 126px, 92px 92px, 120px 120px',
        }}
      >
        {/* 模拟水域 */}
        <div
          style={{
            position: 'absolute',
            top: '-34px',
            right: '-42px',
            width: '150px',
            height: '116px',
            borderRadius: '50%',
            background: theme.mapWater,
            transform: 'rotate(-18deg)',
            opacity: 0.95,
          }}
        />

        {/* 模拟公园 */}
        <div
          style={{
            position: 'absolute',
            bottom: '-26px',
            left: '-22px',
            width: '150px',
            height: '92px',
            borderRadius: '50%',
            background: theme.mapPark,
            transform: 'rotate(12deg)',
          }}
        />

        {/* 横向主干道 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '-20%',
            width: '145%',
            height: '14px',
            boxSizing: 'border-box',
            borderTop: `3px solid ${theme.mapSecondaryRoad}`,
            borderBottom: `3px solid ${theme.mapSecondaryRoad}`,
            background: theme.mapRoad,
            transform: 'translateY(-50%) rotate(-15deg)',
          }}
        />

        {/* 纵向道路 */}
        <div
          style={{
            position: 'absolute',
            top: '-24%',
            left: '54%',
            width: '12px',
            height: '150%',
            background: theme.mapSecondaryRoad,
            transform: 'rotate(25deg)',
            boxShadow: '0 0 0 3px rgba(170, 170, 164, 0.52)',
          }}
        />

        {/* 次级道路 */}
        <div
          style={{
            position: 'absolute',
            top: '24%',
            left: '-5%',
            width: '112%',
            height: '8px',
            background: theme.mapSecondaryRoad,
            transform: 'rotate(8deg)',
            boxShadow: '0 0 0 2px rgba(170, 170, 164, 0.48)',
          }}
        />

        {/* 地图文字 */}
        <span
          style={{
            position: 'absolute',
            top: '24px',
            left: '24px',
            color: theme.mapLabel,
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          CENTRAL DISTRICT
        </span>

        <span
          style={{
            position: 'absolute',
            right: '24px',
            bottom: '30px',
            color: theme.mapLabel,
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          RIVERSIDE
        </span>

        <span
          style={{
            position: 'absolute',
            bottom: '22px',
            left: '28px',
            color: theme.mapLabel,
            fontSize: '8px',
            fontWeight: 700,
            letterSpacing: '0.03em',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          PARK
        </span>

        {/* 定位点 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '42px',
            height: '42px',
            boxSizing: 'border-box',
            border: `1px solid ${theme.locationRing}`,
            borderRadius: '50%',
            background: isUser
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(255, 255, 255, 0.4)',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '18px',
              height: '18px',
              boxSizing: 'border-box',
              border: `4px solid ${theme.locationDotBorder}`,
              borderRadius: '50%',
              background: theme.locationDot,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.28)',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>

        {/* 地图比例尺 */}
        <div
          style={{
            position: 'absolute',
            right: '16px',
            bottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: theme.mapScale,
            fontSize: '8px',
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              display: 'block',
              width: '24px',
              height: '4px',
              boxSizing: 'border-box',
              borderTop: `1px solid ${theme.mapScale}`,
              borderRight: `1px solid ${theme.mapScale}`,
              borderLeft: `1px solid ${theme.mapScale}`,
            }}
          />
          500 m
        </div>
      </div>

      {/* 地点信息区域 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '16px 17px 17px',
        }}
      >
        {/* 图标 */}
        <div
          style={{
            display: 'flex',
            flex: '0 0 auto',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '11px',
            background: theme.iconBackground,
            color: theme.iconColor,
          }}
        >
          <MapPin
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        {/* 文字内容 */}
        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              margin: '0 0 5px',
              color: theme.mainText,
              fontSize: '14px',
              fontWeight: 700,
              lineHeight: 1.45,

              // 防止长英文、URL 或连续字符撑破卡片
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {name}
          </div>

          {note && (
            <div
              style={{
                margin: 0,
                color: theme.secondaryText,
                fontSize: '12px',
                lineHeight: 1.55,

                // 不截断，内容过长时自动换行
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationCard;
