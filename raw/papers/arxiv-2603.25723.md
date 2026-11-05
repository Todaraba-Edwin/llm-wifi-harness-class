---
source: https://arxiv.org/abs/2603.25723
title: "Natural-Language Agent Harnesses"
published: 2026-03-26
authors: Linyue Pan, Lexiao Zou, Shuo Guo, Jingchen Ni, Hai-Tao Zheng
fetched: 2026-11-05
note: abstract only
---

# Natural-Language Agent Harnesses

Agent performance is strongly shaped by the surrounding harness: the external execution system around a model that organizes a task run. Yet this logic is usually buried in tightly coupled controller code, which makes harnesses hard to inspect, compare, transfer, and ablate. This paper asks whether the reusable design pattern of an agent harness can be represented as an executable natural-language object. We introduce Natural-Language Agent Harnesses (NLAHs), editable documents that describe run-level harness policy, and Intelligent Harness Runtime (IHR), a shared runtime that interprets these documents into agent calls, handoffs, state updates, validation gates, and artifact contracts. Across coding, terminal-use, and computer-use benchmarks, IHR-executed NLAHs achieve comparable task outcomes to code and prompted realizations, while exposing much shorter static harness policies. Module ablations further show that explicit harness modules are analyzable. These results suggest that agent harnesses can be turned from incidental glue around models into scientific representation objects.
