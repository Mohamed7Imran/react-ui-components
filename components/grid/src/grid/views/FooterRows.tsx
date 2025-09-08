import {
    forwardRef,
    ForwardRefExoticComponent,
    RefAttributes,
    useImperativeHandle,
    useRef,
    useMemo,
    useCallback,
    memo,
    RefObject,
    JSX,
    useEffect
} from 'react';
import {
    FooterRowsRef,
    IFooterRowsBase,
    RowRef,
    IRow,
    ICell,
    IValueFormatter,
    AggregateType, RenderType
} from '../types';
import { Group, SummaryData, ColumnsChildren } from '../types/interfaces';
import { ColumnProps } from '../types/column.interfaces';
import { AggregateRowProps, AggregateColumnProps, CustomSummaryType } from '../types/aggregate.interfaces';
import {
    useGridMutableProvider,
    useGridComputedProvider
} from '../contexts';
import { RowBase } from '../components';
import { getUid } from '../utils';
import { DateFormatOptions, extend, isNullOrUndefined, NumberFormatOptions } from '@syncfusion/react-base';
import { DataUtil } from '@syncfusion/react-data';

// CSS class constants following enterprise naming convention
const CSS_SUMMARY_ROW: string = 'sf-summaryrow';

/**
 * FooterRowsBase component renders the footer rows within the table footer section
 *
 * @component
 * @private
 * @param {Partial<IFooterRowsBase>} props - Component properties
 * @param {RefObject<FooterRowsRef>} ref - Forwarded ref to expose internal elements and methods
 * @returns {JSX.Element} The rendered tfoot element with footer rows
 */
const FooterRowsBase: ForwardRefExoticComponent<Partial<IFooterRowsBase> & RefAttributes<FooterRowsRef>> =
    memo(forwardRef<FooterRowsRef, Partial<IFooterRowsBase>>(
        (props: Partial<IFooterRowsBase>, ref: RefObject<FooterRowsRef>) => {
            const { tableScrollerPadding, ...rest } = props;

            const { columnsDirective, responseData } = useGridMutableProvider();
            const { aggregates, rowHeight, serviceLocator } = useGridComputedProvider();

            // Refs for DOM elements and child components
            const footerSectionRef: RefObject<HTMLTableSectionElement> = useRef<HTMLTableSectionElement>(null);
            const rowsObjectRef: RefObject<IRow<ColumnProps>[]> = useRef<IRow<ColumnProps>[]>([]);

            /**
             * Returns the collection of footer row elements
             *
             * @returns {HTMLCollectionOf<HTMLTableRowElement> | undefined} Collection of footer row elements
             */
            const getFooterRows: () => HTMLCollectionOf<HTMLTableRowElement> | undefined = useCallback(() => {
                return footerSectionRef.current?.children as HTMLCollectionOf<HTMLTableRowElement>;
            }, [footerSectionRef.current?.children]);

            /**
             * Returns the row options objects with DOM element references
             *
             * @returns {IRow<ColumnProps>[]} Array of row options objects with element references
             */
            const getFooterRowsObject: () => IRow<ColumnProps>[] = useCallback(() => rowsObjectRef.current, [rowsObjectRef.current]);

            /**
             * Expose internal elements and methods through the forwarded ref
             */
            useImperativeHandle(ref, () => ({
                footerSectionRef: footerSectionRef.current,
                getFooterRows,
                getFooterRowsObject
            }), [getFooterRows, getFooterRowsObject]);

            /**
             * Callback to store row element references directly in the row object
             *
             * @param {number} index - Row index
             * @param {HTMLTableRowElement} element - Row DOM element
             */
            const storeRowRef: (index: number, element: HTMLTableRowElement, cellRef: ICell<ColumnProps>[]) => void =
                useCallback((index: number, element: HTMLTableRowElement, cellRef: ICell<ColumnProps>[]) => {
                    // Directly update the element reference in the row object
                    rowsObjectRef.current[index as number].element = element;
                    rowsObjectRef.current[index as number].cells = cellRef;
                }, []);

            const getData: () => AggregateRowProps[] = (): AggregateRowProps[] => {
                const rows: AggregateRowProps[] = [];
                const row: AggregateRowProps[] = aggregates.slice();
                for (let i: number = 0; i < row.length; i++) {
                    const columns: AggregateColumnProps[] = row[parseInt(i.toString(), 10)].columns;
                    if (columns && columns.length) {
                        rows.push({ columns: columns });
                    }
                }
                return rows;
            };

            const getFormatter: (column: AggregateColumnProps) => Function = (column: AggregateColumnProps): Function => {
                const valueFormatter: IValueFormatter = serviceLocator?.getService<IValueFormatter>('valueFormatter');
                if (typeof (column.format) === 'object') {
                    return valueFormatter.getFormatFunction(extend({}, column.format as DateFormatOptions));
                } else if (typeof (column.format) === 'string') {
                    return valueFormatter.getFormatFunction({ format: column.format } as NumberFormatOptions);
                }
                return (a: Object) => a;
            };

            const calculateAggregate: (type: AggregateType | string, data: Object, column?: AggregateColumnProps) => Object =
                (type: AggregateType | string, data: Object, column?: AggregateColumnProps): Object => {
                    if (type === 'Custom') {
                        const temp: CustomSummaryType = column.customAggregate as CustomSummaryType;
                        if (typeof temp === 'string') {
                            return temp;
                        }
                        return temp ? temp(data, column) : '';
                    }
                    return 'result' in data ? DataUtil.aggregates[type.toLowerCase()](data.result, column.field) : null;
                };

            const setTemplate: (column: AggregateColumnProps, data: Object, single: Object) => Object =
                (column: AggregateColumnProps, data: Object, single: Object): Object => {
                    let types: AggregateType[] = column.type as AggregateType[];
                    const formatFn: Function = getFormatter(column);
                    const group: Group = data;
                    if (!(types instanceof Array)) {
                        types = [column.type as AggregateType];
                    }
                    for (let i: number = 0; i < types.length; i++) {
                        const key: string = column.field + ' - ' + types[parseInt(i.toString(), 10)].toLowerCase();
                        const disp: string = column.columnName;
                        const val: Object = types[parseInt(i.toString(), 10)] !== 'Custom' && group.aggregates
                            && key in group.aggregates ? group.aggregates[`${key}`] :
                            calculateAggregate(types[parseInt(i.toString(), 10)], group, column);
                        single[`${disp}`] = single[`${disp}`] || {};
                        single[`${disp}`][`${key}`] = val;
                        single[`${disp}`][types[parseInt(i.toString(), 10)]] = !isNullOrUndefined(val) ? formatFn(val) : '';
                    }
                    return single;
                };

            const buildSummaryData: (args: SummaryData) => Object[] = (args: SummaryData): Object[] => {
                const dummy: Object[] = [];
                const summaryRows: AggregateRowProps[] = getData();
                for (let i: number = 0; i < summaryRows.length; i++) {
                    let single: Object = {};
                    const column: AggregateColumnProps[] = summaryRows[parseInt(i.toString(), 10)].columns;
                    for (let j: number = 0; j < column.length; j++) {
                        single = setTemplate(column[parseInt(j.toString(), 10)], args, single);
                    }
                    dummy.push(single);
                }
                return dummy;
            };

            /**
             * Memoized footer row content to prevent unnecessary re-renders
             */
            const footerRowContent: JSX.Element[] | null = useMemo(() => {
                const rows: JSX.Element[] = [];
                const rowOptions: IRow<ColumnProps>[] = [];
                const summaries: AggregateRowProps[] = getData();
                const data: Object[] = buildSummaryData(responseData);
                // Generate footer rows based on aggregates
                for (let rowIndex: number = 0; rowIndex < summaries.length; rowIndex++) {
                    const options: IRow<ColumnProps> = {};
                    options.uid = getUid('grid-row');
                    options.data = data[parseInt(rowIndex.toString(), 10)];
                    options.index = rowIndex;
                    options.isAggregateRow = true;

                    const rowId: string = `grid-summary-row-${rowIndex}-${Math.random().toString(36).substr(2, 5)}`;
                    // Store the options object for getRowsObject
                    rowOptions.push({ ...options });
                    rows.push(
                        <RowBase
                            ref={(element: RowRef) => {
                                if (element?.rowRef?.current) {
                                    storeRowRef(rowIndex, element.rowRef.current, element.getCells());
                                }
                            }}
                            role='row'
                            row={options}
                            key={rowId}
                            rowType={RenderType.Summary}
                            className={`${CSS_SUMMARY_ROW}`.trim()}
                            data-uid={options.uid}
                            style={{ height: `${rowHeight}px` }}
                            tableScrollerPadding={tableScrollerPadding}
                            aggregateRow={summaries[parseInt(rowIndex.toString(), 10)]}
                        >
                            {(columnsDirective.props as ColumnsChildren).children}
                        </RowBase>
                    );
                }

                // Store the row options in the ref for access via getRowsObject
                rowsObjectRef.current = rowOptions;
                return rows;
            }, [columnsDirective, rowHeight, responseData, tableScrollerPadding]);

            useEffect(() => {
                return () => {
                    rowsObjectRef.current = [];
                };
            }, []);

            return (
                <tfoot
                    {...rest}
                    ref={footerSectionRef}
                >
                    {footerRowContent}
                </tfoot>
            );
        }
    ));

/**
 * Set display name for debugging purposes
 */
FooterRowsBase.displayName = 'FooterRowsBase';

/**
 * Export the FooterRowsBase component for use in other components
 *
 * @private
 */
export { FooterRowsBase };
