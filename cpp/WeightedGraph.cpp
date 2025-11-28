#include "WeightedGraph.h"

WeightedGraph::WeightedGraph(string data_dir, bool with_no_edge) : Graph(data_dir, with_no_edge) {
    assert(is_weighted);
    
    src_to_rate_vec.resize(n);
    node_to_alias.resize(n);
    src_to_dst_to_normalized_weight.resize(n);

    if (with_no_edge) return;
    
    fstream file;
    char splitter = ' ';
    string file_path = "./data/indexed_edges.txt";
    file.open(file_path, ios::in);
    assert(file.is_open());
    string str, line;
    while (getline(file, line)) {
        stringstream ss{line};
        int src_id, dst_id;
        double weight;
        getline(ss, str, splitter);
        src_id = stoi(str);
        getline(ss, str, splitter);
        dst_id = stoi(str);
        getline(ss, str, splitter);
        weight = stod(str);
        if (src_id == dst_id) continue; // ignore self-loop
        _insert_edge_without_updating_alias(src_id, dst_id, weight);
    }
    file.close();

    for (int node_id = 0; node_id < n; node_id++) {
        if (src_to_rate_vec[node_id].size() == 0) continue;
        _normalize_weight(node_id);
        _update_alias(node_id);
    }

    return;
}

int WeightedGraph::get_random_adjacent(int node_id) const {
    // cout << "WeightedGraph::get_random_adjacent is called" << endl;
    if (get_adj_num(node_id) == 0) return -1;
    else {
        int adj_suf = node_to_alias.at(node_id).sample();
        return adj_list_list.at(node_id).at(adj_suf);
    }
}

pair<map<int, double>, map<int, double>> WeightedGraph::calc_ppr_by_fp(const map<int, double>& src_map, int walk_count, double alpha) const {
    map<int, double> normalized_src_map = get_normalized_map(src_map);
    map<int, double> residue, ppr;
    set<int> active_node_set;
    queue<int> active_node_queue;
    for (const auto&[node_id, val] : normalized_src_map) {
        residue.emplace(node_id, val);
        active_node_set.insert(node_id);
        active_node_queue.push(node_id);
    }

    while (active_node_queue.size() > 0) {
        int node_id = active_node_queue.front();
        int node_degree = get_adj_num(node_id);
        active_node_queue.pop();
        active_node_set.erase(node_id);
        // if (ppr.count(node_id) == 0) ppr.emplace(node_id, 0);
        // dangling node 到達時はスーパーノード-1に渡す．スーパーノードはactive node 対象外
        if (node_degree == 0) {
            ppr[node_id] += alpha * residue.at(node_id);
            // if (ppr.count(-1) == 0) ppr.emplace(-1, 0.0);
            ppr[-1] += (1 - alpha) * residue.at(node_id);
        } else {
            vector<int> adj_list = get_adj_list(node_id);
            for (int i = 0; i < node_degree; i++) {
                int adj_id = adj_list[i];
                int adj_degree = get_adj_num(adj_id);
                // if (residue.count(adj_id) == 0) residue.emplace(adj_id, 0);
                residue[adj_id] += (1 - alpha) * residue.at(node_id) * get_normalized_edge_weight(node_id, adj_id);
                if ((residue.at(adj_id) > r_max_func(adj_degree, alpha, walk_count)) && (active_node_set.count(adj_id) == 0)) {
                    active_node_set.insert(adj_id);
                    active_node_queue.push(adj_id);
                }
            }
            ppr[node_id] += alpha * residue.at(node_id);
        }
        residue[node_id] = 0;
    }

    return make_pair(ppr, residue);
}

pair<map<int, double>, map<int, double>> WeightedGraph::calc_ppr_by_fp_full_path(const map<int, double>& src_map, int walk_count, double alpha, double& total_step) const {
    map<int, double> normalized_src_map = get_normalized_map(src_map);
    map<int, double> residue, ppr;
    set<int> active_node_set;
    queue<int> active_node_queue;
    for (const auto&[node_id, val] : normalized_src_map) {
        double walk_amount = (double)walk_count * val;
        residue.emplace(node_id, walk_amount);
        ppr.emplace(node_id, walk_amount);
        total_step += walk_amount;
        active_node_set.insert(node_id);
        active_node_queue.push(node_id);
    }

    while (active_node_queue.size() > 0) {
        int node_id = active_node_queue.front();
        int node_degree = get_adj_num(node_id);
        double residue_val = residue.at(node_id);
        residue[node_id] = 0;
        active_node_queue.pop();
        active_node_set.erase(node_id);
        // if (ppr.count(node_id) == 0) ppr.emplace(node_id, 0);
        // dangling node 到達時はスーパーノード-1に渡す．スーパーノードはactive node 対象外
        if (node_degree == 0) {
            // if (ppr.count(-1) == 0) ppr.emplace(-1, 0.0);
            ppr[-1] += (1 - alpha) * residue_val;
            total_step += (1 - alpha) * residue_val;
        } else {
            for (int adj_id : get_adj_list(node_id)) {
                // if (residue.count(adj_id) == 0) residue.emplace(adj_id, 0);
                double move_walker_val = (1 - alpha) * residue_val * get_normalized_edge_weight(node_id, adj_id);
                residue[adj_id] += move_walker_val;
                ppr[adj_id] += move_walker_val;
                total_step += move_walker_val;
                int adj_degree = get_adj_num(adj_id);
                if ((residue.at(adj_id) > (double)adj_degree / alpha) && (active_node_set.count(adj_id) == 0)) {
                    active_node_set.insert(adj_id);
                    active_node_queue.push(adj_id);
                }
            }
        }
    }

    return make_pair(ppr, residue);
}

vector<double> WeightedGraph::calc_pagerank_by_power_iteration(double alpha, double epsilon) const {
    double tmp_sum = 0;
    vector<double> pr;
    // uniform_real_distribution<double> prob_dist(0.0, 1.0);
    int node_count = node_size();
    pr.resize(node_count);
    for (int node_id = 0; node_id < node_count; node_id++) {
        double tmp = (double)rand()/RAND_MAX;
        tmp_sum += tmp;
        pr[node_id] = tmp;
    }
    for (int node_id = 0; node_id < node_count; node_id++) 
        pr[node_id] = pr.at(node_id) / tmp_sum;

    double l1_norm;
    do {
        map<int, double> new_pr;
        double jump_val = 0.0;
        for (int node_id = 0; node_id < node_count; node_id++) {
            int adj_num = get_adj_num(node_id);
            double pr_val = pr.at(node_id);
            if (adj_num == 0) {
                jump_val += pr_val;
            } else {
                for (int adj_id : get_adj_list(node_id)) {
                    new_pr[adj_id] += pr_val * (1 - alpha) * get_normalized_edge_weight(node_id, adj_id);
                }
                jump_val += pr_val * alpha;
            }
        }
        for (int node_id = 0; node_id < node_count; node_id++) {
            new_pr[node_id] += jump_val / node_count;
        }

        l1_norm = 0;
        for (int node_id = 0; node_id < node_count; node_id++) {
            l1_norm += abs(pr[node_id] - new_pr[node_id]);
            pr[node_id] = new_pr[node_id];
        }
    } while (l1_norm > epsilon);
    return pr;
}

vector<double> WeightedGraph::calc_eigenvector_centrality_by_power_iteration(double epsilon) const {
    double alpha = 0.0;
    return calc_pagerank_by_power_iteration(alpha, epsilon);
}

vector<double> WeightedGraph::calc_degree_centrality() const {
    vector<double> node_to_degree, node_to_dc;
    double total_degree = 0.0;
    for (int node_id = 0; node_id < n; node_id++) {
        double degree = get_weighted_degree(node_id);
        total_degree += degree;
        node_to_degree.push_back((double)degree);
    }
    for (int node_id = 0; node_id < n; node_id++) {
        node_to_dc.push_back(node_to_degree.at(node_id) / total_degree);
    }
    return node_to_dc;
}

vector<double> WeightedGraph::get_distances_by_dijkstra(int source_id) const {
    vector<double> dist(n, numeric_limits<double>::max());
    dist[source_id] = 0.0;

    using P = pair<double, int>; // (距離, ノードID)
    priority_queue<P, vector<P>, greater<P>> pq;
    pq.emplace(0.0, source_id);

    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist[u]) continue;

        const auto& neighbors = get_adj_list(u);
        const auto& weights = src_to_rate_vec[u];

        for (size_t i = 0; i < neighbors.size(); ++i) {
            int v = neighbors[i];
            double w = weights[i];

            if (w <= 0) continue; // 0や負の値は無視（逆数が定義されない）

            double cost = 1.0 / w;

            if (dist[v] > dist[u] + cost) {
                dist[v] = dist[u] + cost;
                pq.emplace(dist[v], v);
            }
        }
    }

    return dist;
}

void WeightedGraph::show_edge_list() const {
    cout << "edge_list" << endl;
    for (int src_id = 0; src_id < n; src_id++) {
        for (int adj_id : adj_set_list.at(src_id)) {
            cout << src_id << " " << adj_id << " " << get_normalized_edge_weight(src_id, adj_id) << endl;
        }
    }
    cout << endl;
}

// undirected graph では両方向挿入. 返り値は挿入したエッジ数
int WeightedGraph::insert_edge(int src_id, int dst_id, double weight) {
    int inserted_count = _insert_edge_without_updating_alias(src_id, dst_id, weight);
    _normalize_weight(src_id);
    _update_alias(src_id);
    if (!is_directed) {
        _normalize_weight(dst_id);
        _update_alias(dst_id);
    }
    return inserted_count;
}

// undirected graph では両方向削除. 返り値は削除したエッジ数
int WeightedGraph::remove_edge(int src_id, int dst_id) {
    // int removed_count = Graph::remove_edge(src_id, dst_id);
    if (!has_edge(src_id, dst_id)) return 0;

    adj_set_list.at(src_id).erase(dst_id);
    auto it = find(adj_list_list.at(src_id).begin(), adj_list_list.at(src_id).end(), dst_id);
    assert(it != adj_list_list.at(src_id).end());
    int removed_suf = distance(adj_list_list.at(src_id).begin(), it);
    adj_list_list.at(src_id)[removed_suf] = adj_list_list.at(src_id).back();
    adj_list_list.at(src_id).pop_back();

    src_to_rate_vec.at(src_id)[removed_suf] = src_to_rate_vec.at(src_id).back();
    src_to_rate_vec.at(src_id).pop_back();

    _normalize_weight(src_id);
    _update_alias(src_id);

    if (!is_directed) {
        adj_set_list.at(dst_id).erase(src_id);
        auto it = find(adj_list_list.at(dst_id).begin(), adj_list_list.at(dst_id).end(), src_id);
        assert(it != adj_list_list.at(dst_id).end());
        int removed_suf = distance(adj_list_list.at(dst_id).begin(), it);
        adj_list_list.at(dst_id)[removed_suf] = adj_list_list.at(dst_id).back();
        adj_list_list.at(dst_id).pop_back();

        src_to_rate_vec.at(dst_id)[removed_suf] = src_to_rate_vec.at(dst_id).back();
        src_to_rate_vec.at(dst_id).pop_back();

        _normalize_weight(dst_id);
        _update_alias(dst_id);

        return 2;
    }

    return 1;
}

// undirected graph では両方向削除. 返り値は削除したエッジ数
int WeightedGraph::_remove_edge_without_updating_alias(int src_id, int dst_id) {
    // int removed_count = Graph::remove_edge(src_id, dst_id);
    if (!has_edge(src_id, dst_id)) return 0;

    adj_set_list.at(src_id).erase(dst_id);
    auto it = find(adj_list_list.at(src_id).begin(), adj_list_list.at(src_id).end(), dst_id);
    assert(it != adj_list_list.at(src_id).end());
    int removed_suf = distance(adj_list_list.at(src_id).begin(), it);
    adj_list_list.at(src_id)[removed_suf] = adj_list_list.at(src_id).back();
    adj_list_list.at(src_id).pop_back();

    src_to_rate_vec.at(src_id)[removed_suf] = src_to_rate_vec.at(src_id).back();
    src_to_rate_vec.at(src_id).pop_back();

    if (!is_directed) {
        adj_set_list.at(dst_id).erase(src_id);
        auto it = find(adj_list_list.at(dst_id).begin(), adj_list_list.at(dst_id).end(), src_id);
        assert(it != adj_list_list.at(dst_id).end());
        int removed_suf = distance(adj_list_list.at(dst_id).begin(), it);
        adj_list_list.at(dst_id)[removed_suf] = adj_list_list.at(dst_id).back();
        adj_list_list.at(dst_id).pop_back();

        src_to_rate_vec.at(dst_id)[removed_suf] = src_to_rate_vec.at(dst_id).back();
        src_to_rate_vec.at(dst_id).pop_back();

        return 2;
    }

    return 1;
}

void WeightedGraph::_normalize_weight(int node_id) {
    src_to_dst_to_normalized_weight.at(node_id).clear();
    const double weight_sum = get_weighted_degree(node_id);
    const int adj_num = get_adj_num(node_id);
    for (int adj_suf = 0; adj_suf < adj_num; adj_suf++) {
        int adj_id = adj_list_list.at(node_id).at(adj_suf);
        double weight = src_to_rate_vec[node_id][adj_suf];
        src_to_dst_to_normalized_weight.at(node_id).emplace(adj_id, weight/weight_sum);
    }
}

int WeightedGraph::_insert_edge_without_updating_alias(int src_id, int dst_id, double weight) {
    int inserted_count = Graph::insert_edge(src_id, dst_id);
    if (inserted_count > 0) {
        src_to_rate_vec[src_id].push_back(weight);
        if (!is_directed) src_to_rate_vec[dst_id].push_back(weight);
    }
    return inserted_count;
}

vector<tuple<int, int, double>> WeightedGraph::load_weighted_edge_list() const {
    vector<tuple<int, int, double>> edge_list;
    fstream file;
    string line;
    char splitter = ' ';
    string file_path = "./data/indexed_edges.txt";
    file.open(file_path, ios::in);
    assert(file.is_open());
    string edge_str;
    while (getline(file, line)) {
        stringstream ss{line};
        int src_id, dst_id;
        double weight;
        getline(ss, edge_str, splitter);
        src_id = stoi(edge_str);
        getline(ss, edge_str, splitter);
        dst_id = stoi(edge_str);
        getline(ss, edge_str, splitter);
        weight = stod(edge_str);
        if (src_id == dst_id) continue; // ignore self-loop
        edge_list.push_back(make_tuple(src_id, dst_id, weight));
    }
    file.close();

    return edge_list;
}