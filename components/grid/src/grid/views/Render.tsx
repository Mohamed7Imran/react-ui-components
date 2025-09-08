import {
    forwardRef,
    ForwardRefExoticComponent,
    RefAttributes,
    useImperativeHandle,
    useRef,
    useLayoutEffect,
    useMemo,
    memo,
    JSX,
    RefObject,
    ReactNode,
    useEffect
} from 'react';
import { HeaderPanelBase, ContentPanelBase, PagerPanelBase, GridToolbar } from './index';
import { RenderRef, IRenderBase, HeaderPanelRef, ContentPanelRef, FooterPanelRef } from '../types';
import { useGridComputedProvider, useGridMutableProvider } from '../contexts';
import { useRender, useScroll } from '../hooks';
import { ToolbarItemConfig, ToolbarAPI } from '../types/toolbar.interfaces';
import { PagerRef } from '@syncfusion/react-pager';
import { FooterPanelBase } from './FooterPanel';
import { Spinner } from '@syncfusion/react-popups';

/**
 * CSS class names used in the Render component
 */
const CSS_CLASS_NAMES: Record<string, string> = {
    GRID_HEADER: 'sf-gridheader sf-lib sf-droppable',
    HEADER_CONTENT: 'sf-headercontent',
    GRID_CONTENT: 'sf-gridcontent',
    CONTENT: 'sf-content',
    GRID_FOOTER: 'sf-gridfooter',
    GRID_FOOTER_PADDING: 'sf-footerpadding',
    FOOTER_CONTENT: 'sf-summarycontent'
};

/**
 * Custom hook to synchronize scroll elements between header and content panels
 *
 * @private
 * @param {Object} headerRef - Reference to the header panel
 * @param {Object} contentRef - Reference to the content panel
 * @param {Object} footerRef - Reference to the footer panel
 * @param {Function} setHeaderElement - Function to set the header scroll element
 * @param {Function} setContentElement - Function to set the content scroll element
 * @param {Function} setFooterElement - Function to set the footer scroll element
 * @param {Function} setPadding - Function to set padding for scroll elements
 * @returns {void}
 */
const useSyncScrollElements: (
    headerRef: RefObject<HeaderPanelRef>,
    contentRef: RefObject<ContentPanelRef>,
    footerRef: RefObject<FooterPanelRef>,
    setHeaderElement: (el: HTMLElement | null) => void,
    setContentElement: (el: HTMLElement | null) => void,
    setFooterElement: (el: HTMLElement | null) => void,
    setPadding: () => void
) => void = (
    headerRef: RefObject<HeaderPanelRef>,
    contentRef: RefObject<ContentPanelRef>,
    footerRef: RefObject<FooterPanelRef>,
    setHeaderElement: (el: HTMLElement | null) => void,
    setContentElement: (el: HTMLElement | null) => void,
    setFooterElement: (el: HTMLElement | null) => void,
    setPadding: () => void
): void => {
    useLayoutEffect(() => {
        const headerElement: HTMLDivElement = headerRef.current?.headerScrollRef;
        setHeaderElement(headerElement);

        const contentElement: HTMLDivElement = contentRef.current?.contentScrollRef;
        setContentElement(contentElement);
        setPadding();

        const footerElement: HTMLDivElement = footerRef.current?.footerScrollRef;
        setFooterElement(footerElement);

        return () => {
            setHeaderElement(null);
            setContentElement(null);
            setFooterElement(null);
        };
    }, [headerRef, contentRef, footerRef.current, setHeaderElement, setContentElement, setFooterElement, setPadding]);
};

/**
 * Base component for rendering the grid structure with header and content panels
 *
 * @component
 */
const RenderBase: ForwardRefExoticComponent<Partial<IRenderBase> & RefAttributes<RenderRef>> = memo(
    forwardRef<RenderRef, Partial<IRenderBase>>((_props: Partial<IRenderBase>, ref: RefObject<RenderRef>) => {
        const headerPanelRef: RefObject<HeaderPanelRef> = useRef<HeaderPanelRef>(null);
        const contentPanelRef: RefObject<ContentPanelRef> = useRef<ContentPanelRef>(null);
        const footerPanelRef: RefObject<FooterPanelRef> = useRef<FooterPanelRef>(null);
        const pagerObjectRef:  RefObject<PagerRef> = useRef<PagerRef>(null);

        const { privateRenderAPI, protectedRenderAPI } = useRender();
        const { privateScrollAPI, protectedScrollAPI, setHeaderScrollElement, setContentScrollElement, setFooterScrollElement } =
            useScroll();
        const { setPadding } = protectedScrollAPI;
        const { headerContentBorder, headerPadding, onContentScroll, onHeaderScroll, onFooterScroll, getCssProperties } = privateScrollAPI;
        const { textWrapSettings, pageSettings, aggregates, toolbar, id } = useGridComputedProvider();
        const { columnsDirective, currentViewData, totalRecordsCount, cssClass, toolbarModule, editModule } = useGridMutableProvider();

        // Synchronize scroll elements between header and content panels
        useSyncScrollElements(
            headerPanelRef,
            contentPanelRef,
            footerPanelRef,
            setHeaderScrollElement,
            setContentScrollElement,
            setFooterScrollElement,
            setPadding
        );

        // Expose methods and properties through ref
        useImperativeHandle(ref, () => ({
            // Render specific methods
            refresh: protectedRenderAPI.refresh,
            showSpinner: protectedRenderAPI.showSpinner,
            hideSpinner: protectedRenderAPI.hideSpinner,
            scrollModule: protectedScrollAPI,
            // Forward all properties from header and content panels
            ...(headerPanelRef.current as HeaderPanelRef),
            ...(contentPanelRef.current as ContentPanelRef),
            ...(footerPanelRef.current as FooterPanelRef),
            pagerModule: pagerObjectRef.current
        }), [
            protectedRenderAPI.refresh,
            headerPanelRef.current,
            contentPanelRef.current,
            footerPanelRef.current,
            pagerObjectRef.current
        ]);

        const pagerPanel: JSX.Element = useMemo(() => (
            <PagerPanelBase
                ref={pagerObjectRef}
                {...pageSettings}
            />

        ), [totalRecordsCount, pageSettings]);


        // Memoize header panel to prevent unnecessary re-renders
        const headerPanel: JSX.Element = useMemo(() => (
            <HeaderPanelBase
                ref={headerPanelRef}
                panelAttributes={{
                    style: headerPadding,
                    className: CSS_CLASS_NAMES.GRID_HEADER
                }}
                scrollContentAttributes={{
                    style: headerContentBorder,
                    className: CSS_CLASS_NAMES.HEADER_CONTENT,
                    onScroll: onHeaderScroll
                }}
            />
        ), [headerPadding, headerContentBorder, onHeaderScroll]);

        // Memoize content panel to prevent unnecessary re-renders
        const contentPanel: JSX.Element = useMemo(() => (
            <ContentPanelBase
                ref={contentPanelRef}
                setHeaderPadding={setPadding}
                panelAttributes={{
                    className: `${CSS_CLASS_NAMES.GRID_CONTENT} ${textWrapSettings?.enabled &&
                        textWrapSettings?.wrapMode === 'Content' ? 'sf-wrap' : ''}`.trim()
                }}
                scrollContentAttributes={{
                    className: CSS_CLASS_NAMES.CONTENT,
                    style: privateRenderAPI.contentStyles,
                    'aria-busy': privateRenderAPI.isContentBusy,
                    onScroll: onContentScroll,
                    tabIndex: -1
                }}
            />
        ), [setPadding, privateRenderAPI.contentStyles, privateRenderAPI.isContentBusy, onContentScroll]);

        const footerPanel: JSX.Element = useMemo(() => {
            if (!columnsDirective || !currentViewData || currentViewData.length === 0) {
                return null;
            }
            const tableScrollerPadding: boolean = headerPadding[`${getCssProperties.padding}`] && headerPadding[`${getCssProperties.padding}`] !== '0px' ? true : false;
            const cssClass: string = `${CSS_CLASS_NAMES.GRID_FOOTER} ${tableScrollerPadding ? CSS_CLASS_NAMES.GRID_FOOTER_PADDING : ''}`;
            return (<FooterPanelBase
                ref={footerPanelRef}
                panelAttributes={{
                    style: headerPadding,
                    className: cssClass.trim()
                }}
                scrollContentAttributes={{
                    className: CSS_CLASS_NAMES.FOOTER_CONTENT,
                    onScroll: onFooterScroll
                }}
                tableScrollerPadding={tableScrollerPadding}
            />);
        }, [headerPadding, getCssProperties, columnsDirective, currentViewData, onFooterScroll]);

        useEffect(() => {
            if (!privateRenderAPI.isContentBusy && editModule?.isShowAddNewRowActive && !editModule?.isShowAddNewRowDisabled) {
                contentPanelRef?.current?.addInlineRowFormRef?.current?.focusFirstField();
            }
        }, [privateRenderAPI.isContentBusy]);

        return (
            <>
                <Spinner visible={privateRenderAPI.isContentBusy} className={cssClass}/>
                {toolbarModule && toolbar?.length > 0 && (
                    <GridToolbar
                        key={id + '_grid_toolbar'}
                        className={cssClass}
                        toolbar={(toolbar as (string | ToolbarItemConfig)[]) || []}
                        gridId={id}
                        toolbarAPI={toolbarModule as ToolbarAPI}
                    />
                )}
                {headerPanel}
                {contentPanel}
                {aggregates?.length ? footerPanel : null}
                {pageSettings?.enabled && pagerPanel}
            </>
        );
    })
);

/**
 * Columns component that wraps RenderBase for external usage
 *
 * @returns {JSX.Element} Rendered component
 */
export const Columns: React.FC<{ children?: ReactNode }> = (): JSX.Element => {
    return null;
};

export {
    RenderBase
};

RenderBase.displayName = 'RenderBase';
