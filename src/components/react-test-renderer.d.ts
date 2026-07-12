/**
 * Minimal ambient types for `react-test-renderer`, used by this component
 * library's colocated *.test.tsx files. No `@types/react-test-renderer`
 * package is installed in this project, so we declare just the surface
 * area these tests rely on (create/act plus a bare-bones TestInstance).
 */
declare module 'react-test-renderer' {
  import * as React from 'react';

  export interface TestInstance {
    readonly type: React.ElementType | string;
    readonly props: Record<string, any>;
    find(predicate: (node: TestInstance) => boolean): TestInstance;
    findAll(predicate: (node: TestInstance) => boolean, options?: { deep?: boolean }): TestInstance[];
    findByType(type: React.ElementType | string): TestInstance;
    findAllByType(type: React.ElementType | string): TestInstance[];
    findByProps(props: Record<string, any>): TestInstance;
    findAllByProps(props: Record<string, any>): TestInstance[];
  }

  export interface ReactTestRendererJSON {
    type: string;
    props: Record<string, any>;
    children: (ReactTestRendererJSON | string)[] | null;
  }

  export interface ReactTestRenderer {
    toJSON(): ReactTestRendererJSON | null;
    unmount(): void;
    update(nextElement: React.ReactElement): void;
    readonly root: TestInstance;
  }

  export function create(element: React.ReactElement, options?: unknown): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): Promise<void> | void;

  const TestRenderer: { create: typeof create };
  export default TestRenderer;
}
